# Tenure — Confidential Prize Savings

A no-loss prize savings pool where **balances are encrypted** and **odds are weighted by how long you have held** —
PoolTogether V5's time-weighted model, implemented over ciphertext on the
[Zama Protocol](https://docs.zama.org/protocol).

> **Status: contracts live on Sepolia, frontend in progress.** The contracts are deployed, Etherscan-verified, and have
> completed a full three-participant draw on-chain, with every transaction hash listed below. The web frontend and the
> demo video are still being built; nothing here claims a result that has not been produced.

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

### Wiring and trust assumptions

The pool and the reserve each need the other's address. Rather than predicting a CREATE2 address — where the prediction
depends on the bytecode, so any edit to `PrizeReserve` silently shifts it — the pool is deployed first and wired
afterwards through a one-shot `setReserve`. It fails safe: an unwired pool cannot record a funded prize, and
`closeEpoch` refuses to run without one, so a half-deployed system simply cannot draw.

The cost is one storage read in `notifyPrizeFunded`, which runs once per epoch, and one trust assumption worth stating
plainly: **whoever holds `ADMIN` at deployment chooses the reserve.** A malicious reserve could call `notifyPrizeFunded`
to inflate `prizeAmount` without depositing real cUSDC, leaving the pool unable to pay a winner. `setReserve` is
one-shot, so this is fixed at deployment and cannot be repointed later, and the deploy script wires it in the same run.
Verify the wired address before trusting a deployment.

Timing windows are constructor parameters and are validated against `MIN_WINDOW` (60s). A zero claim window would make
the prize rollable in the same block it becomes claimable, so a winner could never realistically take it; the
constructor rejects it rather than allowing a deployment nobody could win from.

### Sepolia addresses

Tenure uses Zama's published tokens rather than deploying its own, which also satisfies the brief's faucet requirement:
judges mint the underlying directly, then wrap it.

| Contract                 | Address                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `TenurePool`             | [`0x76012034adbcF3786798bf2b9C7972FA975bb339`](https://sepolia.etherscan.io/address/0x76012034adbcF3786798bf2b9C7972FA975bb339#code) |
| `PrizeReserve`           | [`0x03cf9Dae9A39A34d9388de1EF16eE136F1507F2a`](https://sepolia.etherscan.io/address/0x03cf9Dae9A39A34d9388de1EF16eE136F1507F2a#code) |
| Mock USDC (public mint)  | [`0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF`](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF)      |
| cUSDC (ERC-7984 wrapper) | [`0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639)      |

Both Tenure contracts are verified on Etherscan.

**Deployed timing.** `DRAW_TIMEOUT` and `CLAIM_WINDOW` are both **600 seconds** on this deployment, deliberately short
so a complete cycle fits inside a demo and judges can click through one themselves. They are constructor parameters, not
constants; a production deployment would use hours for the stall timeout and days for the claim window.

### A verified draw

One complete three-participant cycle, run on Sepolia. Three savers deposited 300,000, 200,000 and 500,000 base units and
had each held across four epoch boundaries, so every stake counted at the top 8x tenure tier: the published weighted
total is **8,000,000** against 1,000,000 of deposits. That eightfold gap is the tenure multiplier, visible on-chain
rather than merely described.

| Step                       | Transaction                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Fund the epoch prize       | [`0xd8e51038…`](https://sepolia.etherscan.io/tx/0xd8e510389ce25f4ad0d4db547aab8546fdf406abf43badec777ef7791c0a5a61) |
| Close the epoch            | [`0x504f1725…`](https://sepolia.etherscan.io/tx/0x504f17251f8e13441e472eb144c1c952dba8f5eb4df98c768a443c2efa3c82c7) |
| Build the encrypted ladder | [`0x7a0479d5…`](https://sepolia.etherscan.io/tx/0x7a0479d5ac65e6379cf864220a0da3b9353500a17555afcef7eeb215559aee9c) |
| Publish total, draw `W`    | [`0x4218cd6d…`](https://sepolia.etherscan.io/tx/0x4218cd6d676179cfddb72d3652d56770ff71e3fa946071a94ba3bb206a677e6e) |
| Publish the winning number | [`0x54dd1bbc…`](https://sepolia.etherscan.io/tx/0x54dd1bbc212193cd9466ffa89dc1c2b7327b9a5e0fdddb23281ec19e529a7c8c) |
| Winner claims              | [`0x521a2331…`](https://sepolia.etherscan.io/tx/0x521a2331114a5628b8910a28bdebf00ec026c30173ef90d22607b561c574c807) |
| Winner banks the prize     | [`0x9ec1d9fa…`](https://sepolia.etherscan.io/tx/0x9ec1d9fa41c70e0b3f50a31ecbe891bea5cfe4e4ce845cd428c8084e10ed457f) |

Published total **8,000,000**. Published winning number **523,794**, which falls in the first range. All three
participants claimed and decrypted their own results: `1,000,000`, `0` and `0` — exactly one winner, identifiable only
by that participant decrypting their own handle. The winner's balance became 2,300,000: their 300,000 stake plus this
prize and the one they had already won in an earlier epoch.

Every transaction from the run is recorded in [`docs/cycle-sepolia.json`](docs/cycle-sepolia.json).

### Reproducing it

```bash
npx hardhat run scripts/preflight.ts --network sepolia
```

```bash
npx hardhat deploy --network sepolia --tags Tenure
```

```bash
PLAYERS=3 npx hardhat run scripts/live-cycle.ts --network sepolia
```

`scripts/live-cycle.ts` doubles as the reference keeper: it fetches each cleartext and KMS proof from the relayer and
submits both on-chain. It is idempotent, so a run interrupted by a relayer timeout resumes where it stopped.

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

### Deploying the frontend

The repository root is the Hardhat project; the web app lives in `frontend/` with its own `package.json`, lockfile and
toolchain. On Vercel this means one setting matters:

**Project Settings → Build and Deployment → Root Directory → `frontend`**

`frontend/vercel.json` pins the framework preset to `nextjs`, so the build does not depend on Vercel's auto-detection
having run against the right directory when the project was first created.

Without it Vercel builds the repository root, finds no `next` dependency and no `build` script, produces no routable
output, and every path returns a plain-text `NOT_FOUND` from the edge rather than the app's own 404 page. No environment
variables are required: contract addresses have defaults and the RPC endpoint is public by design, since anything
prefixed `NEXT_PUBLIC_` is compiled into the browser bundle.

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
