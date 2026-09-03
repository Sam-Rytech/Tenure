# Tenure — Confidential Prize Savings

A no-loss prize savings pool where **balances are encrypted** and **odds are weighted by how long you have held** —
PoolTogether V5's time-weighted model, implemented over ciphertext on the
[Zama Protocol](https://docs.zama.org/protocol).

> **Status: in development.** Contracts are written, compiling, and passing a full-cycle test in the FHEVM mock
> environment. Sepolia deployment, the live demo, and the frontend are in progress. Sections below marked _pending_ are
> not yet true; nothing here claims a result that has not been produced.

---

## The problem

Prize savings pools get sniped. Because every balance is public on-chain, capital watches the pool, deposits immediately
before a draw, claims odds proportional to a balance it held for minutes, and withdraws immediately after. Long-term
savers quietly subsidise it. PoolTogether V5 needed a time-weighted average balance (TWAB) to survive exactly this.

## What Tenure does

Two changes, and they compound:

1. **Balances are encrypted.** Not hidden behind a UI — actually stored as ciphertext. That removes the information a
   sniper depends on; they cannot see the pool to time their entry.
2. **Odds scale with tenure.** 1× → 2× → 4× → 8× as you hold across epochs. Any deposit or withdrawal resets you to
   tier 0.

Confidentiality removes the sniper's inputs. Tenure removes their payoff.

Principal is never at risk and never locked: you only ever gamble the prize.

## How a draw works

```
OPEN ──closeEpoch()───────────────────────────► LADDER_BUILD
  requires the epoch prize to be funded; snapshots the participant count;
  zero participants roll over without entering the machine

LADDER_BUILD ──buildChunk() × ⌈N/20⌉──────────► TOTAL_PENDING
  each participant gets an encrypted ticket range [start, end)
  weight = FHE.shl(balance, tierShift); the final chunk publishes the total

TOTAL_PENDING ──submitTotal(clear, proof)─────► WINNER_PENDING
  FHE.checkSignatures verifies the KMS proof over the decrypted total
  a zero total aborts to OPEN and rolls forward, so rem never sees a zero divisor
  otherwise r = FHE.randEuint64(); W = FHE.rem(r, total)

WINNER_PENDING ──submitWinner(clear, proof)───► CLAIMABLE
  W becomes public; every ticket range stays encrypted

CLAIMABLE ──claim window expires──────────────► OPEN
```

Every phase-advancing function is **permissionless**, and none require `msg.value`.

### Claim-time evaluation

There is no settlement phase. Each participant evaluates their own claim:

```solidity
ebool inRange = FHE.and(FHE.le(rung.start, w), FHE.gt(rung.end, w));
euint64 award = FHE.select(inRange, FHE.asEuint64(prize), ZERO);
account.pendingPrize = FHE.add(account.pendingPrize, award);
```

Non-winners receive an **encrypted zero**, so calling `claimPrize` reveals nothing about the outcome. The claimant then
decrypts `pendingPrize` via the EIP-712 user-decryption flow to learn privately whether they won. This means unbounded
participants, no HCU cliff, no settle cursor, and the claimant pays their own gas.

## Confidentiality design

| Public                                   | Encrypted                      |
| ---------------------------------------- | ------------------------------ |
| Total weighted ticket count per epoch    | Every individual balance       |
| The winning ticket **number** `W`        | Every individual ticket range  |
| Prize amount                             | Every individual pending prize |
| Epoch boundaries, tier schedule          | Winner identity                |
| Participation (transactions are visible) | Raw pool TVL                   |

`FHE.randEuint64()` produces the randomness on-chain — no off-chain RNG, no VRF. It is reduced modulo the published
total with `FHE.rem`. The total **must** be public because `FHE.div` and `FHE.rem` accept plaintext divisors only, and
`FHE.randEuint64(bound)` requires a power-of-two bound. Only `W` is made publicly decryptable; the ranges stay
ciphertext, so nobody can locate `W` among them.

## What leaks

Stated plainly rather than softened.

- **Participation is public.** Transactions are visible; amounts are not.
- **Tenure tier is public**, derived from deposit block — already inferable from transaction history, and plaintext
  tiers let the multiplier be a cheap scalar shift.
- **The weighted total is public.** It loosely bounds aggregate TVL. Required for the modulus.
- **Small anonymity sets.** With few participants, an observer who independently knows some balances can narrow the
  winner. Inherent to any pool.
- **Modulo bias.** `W = r mod total` with `r` uniform over `[0, 2^64)`. Bias is bounded by `total / 2^64`, below `2^-40`
  for any realistic pool.
- **`FHE.allow` grants are irrevocable.** Mitigated by handle rotation: every balance update produces a fresh handle,
  staling prior grants.
- **Claim timing.** Claiming reveals that you are checking. Only a successful claim reveals a win, and only to an
  observer watching that address.
- **Unclaimed prizes.** Because awards are encrypted, the contract cannot distinguish a winning claim from a losing one.
  A prize rolls forward only when _nobody_ claimed. If a non-winner claims but the actual winner never does, that prize
  stays in the pool rather than rolling forward.

## Error recovery

Season 3 entrants were publicly challenged for leaving funds stuck with no way out. Every path that can stall has an
escape:

| Failure                                    | Recovery                                                         |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Nobody submits a decryption (either round) | `abortDraw()` after timeout, permissionless; prize rolls forward |
| Ladder build stalls mid-chunk              | Same `abortDraw()`; resets the cursor, state → `OPEN`            |
| Epoch closed with zero participants        | `closeEpoch` rolls over without entering the machine             |
| Weighted total decrypts to zero            | `submitTotal` aborts to `OPEN`; `rem` never sees a zero divisor  |
| Duplicate or replayed decryption           | No-op, guarded by phase; `checkSignatures` binds the proof       |
| Prize never claimed                        | Rolls forward at `finalizeEpoch`, permissionless                 |
| User claims twice for one epoch            | `hasClaimed[epoch][user]` guard, reverts cleanly                 |
| Epoch underfunded                          | Unreachable — `closeEpoch` reverts unless the prize is funded    |
| Withdrawal during any draw phase           | Always permitted. Principal is never locked                      |

**The invariant:** no user action, decryption failure, or draw phase can make principal unrecoverable. Principal is
_self-balancing_ — `deposit` credits exactly the `euint64` returned by `confidentialTransferFrom`, so recorded liability
never exceeds cUSDC actually held.

## Why the design fits FHEVM's limits

Two per-transaction ceilings: **20,000,000 global** and **5,000,000 sequential depth**.

The cumulative ladder sum is inherently sequential, which makes it depth-bound:

```
depth   20 × 162,000            =  3,240,000  <  5,000,000
global  20 × (34,000 + 162,000) =  3,920,000  < 20,000,000
LADDER_CHUNK = 20
```

The `shl` branches off the sequential chain, so only the `add` chain counts toward depth.

Tiers are powers of two deliberately: a scalar `shl` costs 34,000 HCU against `mul` at 365,000 — a tenfold saving on the
hottest operation, and a cleaner user rule.

The draw itself is `randEuint64` (24,000) + `rem` (1,153,000) = **1,177,000**, about 24% of the depth ceiling.

`FHE.sum` is **not applicable** here, rather than merely deferred: it reduces a list to one total, whereas the ladder
needs prefix sums — every participant's running `start` and `end`.

## Decryption: self-relaying

`FHE.requestDecryption` and `FHE.setDecryptionOracle` were deprecated in protocol v0.9 and must be removed, so there is
no oracle callback. Decryption is self-relayed in three steps:

```
on-chain   FHE.makePubliclyDecryptable(handle)
off-chain  SDK publicDecrypt(handle) -> cleartext + proof
on-chain   FHE.checkSignatures(handles, abi.encode(cleartext), proof)
```

Consequences: no oracle liveness risk, no `msg.value` anywhere, and a keeper script is required infrastructure rather
than a convenience.

## The prize reserve

Admin-funded, as the brief permits in place of a real yield source. It holds plaintext ERC-20 and wraps it into
confidential cUSDC **directly to the pool**.

The plaintext path is deliberate: `confidentialTransfer` returns an encrypted zero on a shortfall rather than reverting,
so the pool could silently underfund itself and pay the eventual winner nothing. ERC-20 `transferFrom` reverts instead,
so funding fails loudly. A production deployment plugs a yield adapter (a Morpho vault, as in Zama's own Confidential
Vault) in behind `fundEpoch`.

## Contracts

| Contract           | Role                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `DrawEngine.sol`   | Five-phase draw machine, encrypted ticket ladder, on-chain randomness |
| `TenurePool.sol`   | Encrypted balances, tenure weighting, deposits, claims, withdrawals   |
| `PrizeReserve.sol` | Admin-funded prize source and the wrap bridge into the pool           |

`DrawEngine` is an abstract base that `TenurePool` inherits, so every ciphertext lives at a single address and no
cross-contract ACL grants are needed for balances or rungs.

### Sepolia addresses

_Pending deployment._ Tenure uses Zama's published tokens rather than deploying its own, which also satisfies the
brief's faucet requirement — judges mint the underlying directly:

| Contract                 | Address                                      |
| ------------------------ | -------------------------------------------- |
| Mock USDC (public mint)  | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| cUSDC (ERC-7984 wrapper) | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |

## Local setup

Requires Node 20+.

```bash
npm ci
```

```bash
npm run compile
```

```bash
npm test
```

To deploy, set the three Hardhat variables first (each prompts; nothing is written into the repo):

```bash
npx hardhat vars set MNEMONIC
```

```bash
npx hardhat vars set INFURA_API_KEY
```

```bash
npx hardhat vars set ETHERSCAN_API_KEY
```

```bash
npm run deploy:sepolia
```

### Tests

The full-cycle test drives fund → deposit ×3 → close → build ladder → submit total → submit winner → claim → withdraw,
and asserts that **exactly one** participant receives the prize and that it is the one whose encrypted range actually
contains `W`.

Because the mock environment enforces `checkSignatures` but does not expose the plugin's signing helper,
`test/helpers/decryption.ts` signs the `PublicDecryptVerification` EIP-712 payload using the mock KMS key published in
`@fhevm/hardhat-plugin`. A companion test confirms a proof signed over the _wrong_ value is rejected, so the helper is
not quietly bypassing verification.

## Anti-gaming

| Attack                               | Defence                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| Deposit right before a draw          | Tier 0 (1×) against long-holders' 8×; eligibility defers    |
| Deposit during ladder build          | Excluded from the epoch by the participant snapshot         |
| Hold dust, then deposit large        | Any deposit resets tenure                                   |
| Withdraw and redeposit to game tiers | Any withdrawal resets tenure                                |
| Observe the pool to time entry       | Balances encrypted; only the weighted aggregate is visible  |
| Grief by never advancing state       | Permissionless phases; timeouts on every waiting phase      |
| Sybil-split across addresses         | No benefit — odds are linear in balance, each starts tier 0 |

## Deliberately not built

- True per-block TWAB — epoch-granular tenure achieves the same economic goal far more cheaply
- Multiple winners / prize tiers — one winner per epoch
- Real yield source — the brief explicitly permits an admin-funded reserve
- Upgradeability — immutable for this submission

## Future work

Per-block TWAB · multiple prize tiers · an append-only ladder avoiding the O(N) rebuild · a real yield adapter behind
`fundEpoch` · a standalone `/verify/[epoch]` route · mobile layout.

## Licence

MIT — see [LICENSE](LICENSE). Scaffolded from
[zama-ai/fhevm-hardhat-template](https://github.com/zama-ai/fhevm-hardhat-template), whose BSD-3-Clause-Clear notice is
retained in [LICENSE-zama-template.txt](LICENSE-zama-template.txt).
