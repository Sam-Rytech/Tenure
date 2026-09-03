# Tenure — Architecture

**A confidential TWAB port of PoolTogether V5, built on the Zama Protocol**

Season 4 bounty · Sepolia · Deadline **6 Sep 2026, 12:00 UTC / 13:00 Lagos**

> **Revision 4.** Decryption flow resolved against the live protocol; HCU costs re-verified. Changes marked **[R4]**.
> Revision 3 changes marked **[R3]**, Revision 2 **[R2]**.

---

## 1. Positioning

**[R3]** Tenure is not "PoolTogether with encryption bolted on." It is a confidential implementation of PoolTogether
**V5's own TWAB model** — the time-weighted average balance mechanism the real protocol uses to compute odds, where a
user's chance of winning depends on the balance they held _and how long they held it_.

This framing matters for three reasons:

1. **It's faithful to the source protocol**, so it reads as depth rather than deviation. V5 computes a winning zone from
   `tierOdds × userTwab × vaultPortion`. Tenure computes the encrypted equivalent.
2. **It closes the "deposit-weighted" compliance question.** We aren't inventing a weighting scheme — we're implementing
   the one PoolTogether already audits.
3. **It's the strongest available differentiator.** Most Season 4 entrants will build the literal brief: encrypted
   deposit, encrypted balance, random winner. Tenure implements the mechanism that makes prize savings economically
   sound.

**The thesis, in one line:** confidentiality isn't decoration here — it's the fix for prize savings' central flaw. On a
transparent chain, capital enters before a draw, claims odds proportional to a balance it held for minutes, and exits.
Encrypt balances and that strategy loses its inputs. Weight by tenure and it loses its payoff.

### Competitive context **[R3]**

At least two public Season 4 repos exist, one explicitly framed as "a confidential port of PoolTogether v5 — encrypted
balances, encrypted odds, and a winner nobody can identify." Assume the encrypted-winner angle is contested. **Tenure's
defensible ground is the tenure weighting plus the public draw-audit surface** (§7), not the encryption itself.

---

## 2. What the last three seasons say wins

**[R3]** Evidence-based, from Zama's winner announcements and community threads:

| Signal                            | Evidence                                                                                                                | What we do                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Live demo is mandatory            | Every Mainnet S1–S3 winner shipped a deployed prototype                                                                 | Vercel URL live on Day 0                          |
| Error handling is scored          | S3 winners were publicly challenged for having no recovery path for a failed unwrap — funds could stick with no way out | §6 recovery paths, first-class                    |
| UX and frontend explicitly judged | S3 tracks judged on "UX, code quality, production-readiness"                                                            | Four screens, seven error states                  |
| One signature feature beats many  | S3 winners shared a brief but differed by identity — cToken's delegated decryption, Blackout's one-click "go dark"      | Public draw audit (§7)                            |
| Real-person video, no AI voice    | Stated rule; AI voice is disqualifying                                                                                  | Scripted, real voice, ≤3 min                      |
| Winner-take-all is possible       | "An exceptional project may receive the full prize pool"                                                                | Aim to be the reference implementation, not top-3 |
| Audit-readiness is scored         | Strongest submission may get an OpenZeppelin audit                                                                      | Clean contracts, NatSpec, invariants              |

---

## 3. Privacy boundary

| Public                                           | Encrypted                             |
| ------------------------------------------------ | ------------------------------------- |
| Total weighted ticket count per epoch            | Every individual balance              |
| The winning ticket **number** `W`                | Every individual ticket range         |
| Prize amount (reserve is plaintext ERC-20)       | Every individual pending prize        |
| Epoch boundaries, tier schedule, weight function | Winner identity                       |
| Participation (txs are visible)                  | Raw pool TVL — not directly published |

### The mechanism

- `FHE.randEuint64()` produces encrypted randomness on-chain. No off-chain RNG, no VRF.
- Reduced modulo the published total via `FHE.rem`. Legal because **`FHE.div` and `FHE.rem` accept plaintext divisors
  only**, and **`FHE.randEuint64(bound)` requires a power-of-two bound** — which is precisely why the total must be
  public.
- Only `W` is made publicly decryptable. Anyone verifies the draw was generated on-chain, correctly bounded, honestly
  revealed.
- Ranges stay ciphertext, so nobody can locate `W` among them.

### Documented leakage

The brief explicitly asks for this section. Reproduce it verbatim in the README.

- **Participation is public.** Transactions are visible; amounts are not.
- **Tenure tier is public**, derived from deposit block — already inferable from tx history, and plaintext tiers let the
  multiplier be a cheap scalar shift.
- **Weighted total is public.** Loosely bounds aggregate TVL. Required for the modulus.
- **Small anonymity sets.** With few participants, an observer who independently knows some balances can narrow the
  winner. Inherent to any pool.
- **Modulo bias.** `W = r mod total`, `r` uniform over `[0, 2^64)`. Bias bounded by `total / 2^64`, below `2^-40` for
  any realistic pool.
- **`FHE.allow` grants are irrevocable.** Mitigated by handle rotation — every balance update produces a fresh handle,
  staling prior grants.
- **Claim timing.** A user who claims reveals they are checking; only a successful claim reveals a win, and only to
  observers watching that address. **[R3]**

---

## 4. Tenure weighting

**[R3]** The weight function is a **parameter**, not a hardcoded rule. Setting all shifts to zero reduces the contract
to strict deposit-weighting — canonical PoolTogether. Demonstrated in tests, stated in the README. Any doubt about brief
compliance is closed without losing the differentiator.

```solidity
uint8[4] public tierShifts;   // default [0,1,2,3] → 1x, 2x, 4x, 8x
                              // [0,0,0,0]         → strict deposit-weighting
```

| Complete epochs held | Multiplier | Implementation    |
| -------------------- | ---------- | ----------------- |
| 0                    | 1x         | `shl(balance, 0)` |
| 1                    | 2x         | `shl(balance, 1)` |
| 2–3                  | 4x         | `shl(balance, 2)` |
| 4+                   | 8x         | `shl(balance, 3)` |

Powers of two are deliberate: scalar `shl` costs 34,000 HCU against `mul` at 365,000. Tenfold saving on the hottest
operation, and a cleaner user rule — "hold four epochs, quadruple your odds."

Any deposit or withdrawal resets tier to 0. Closes "hold dust for four epochs, then deposit big."

**Overflow guard.** ERC-7984 defaults to **6 decimals** against a euint64 ceiling of ≈1.8×10^19, so a balance shifted
left by 3 must stay under that. Enforced by a per-account deposit cap, asserted in tests.

---

## 5. HCU budget

Two per-transaction ceilings: **20,000,000 global**, **5,000,000 sequential depth**. Exceed either and the transaction
reverts. Anything accumulating into one ciphertext is depth-bound first.

euint64, verified against the published cost table: `add` 133k scalar / 162k non-scalar · `shl` 34k scalar · `le` 119k /
`lt` 118k / `gt` 117k scalar · `select` 55k · `randEuint64` 24k · `div` by plaintext 715k · **`rem` by plaintext
1,153,000**.

**[R4] The modulus cost was wrong.** Revision 3 quoted 715k. That is `div`. `rem` — the operation we actually use — is
**1,153,000**, roughly 1.6× more. Still comfortable: the draw transaction is `randEuint64` + `rem` ≈ **1,177,000**, 24%
of the depth ceiling.

**Ladder build** — cumulative sum is inherently sequential:

```
depth   20 × 162,000            =  3,240,000  <  5,000,000   ok
global  20 × (34,000 + 162,000) =  3,920,000  < 20,000,000   ok
LADDER_CHUNK = 20
```

The `shl` branches off the sequential chain, so only the `add` chain counts toward depth. Headroom to the depth ceiling
is 35%. `LADDER_CHUNK = 20` stands.

**`claimPrize`** ≈ `le` 119k + `gt` 117k + `ebool and` + `select` 55k + `add` 133k ≈ **450k**. Revision 3's "~350k"
omitted one comparison. The `ebool and` is not in the published cost table and is measured empirically during
implementation.

**[R3] Settlement is gone.** Claim-time evaluation (§6.2) means no chunked settle phase, no `SETTLE_CHUNK`, and no cap
on participant count at settlement. The ladder build is now the only chunked operation in the system.

**[R4] `FHE.sum` is not applicable** — a structural reason, not an unknown cost. Added in v0.13, it reduces a list to
**one total**. The ladder needs **prefix sums**: every participant's running `start` and `end`. `FHE.sum` cannot produce
those, so it cannot shorten the sequential chain. It would only replace the final total, which already falls out free as
the last rung. Remove it from the README's production-optimisation list.

---

## 6. Contracts

```
Zama Sepolia registry — do NOT deploy our own token
  underlying MockUSDC  0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF   public mint, 1M/call
  cUSDCMock (ERC7984)  0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639
  Wrappers Registry    0x2f0750Bbb0A246059d80e94c454586a7F27a128e

  TenurePool ── DrawEngine ── PrizeReserve (admin-funded, plaintext ERC-20)
                                     |
                                     +- fundEpoch(): approve the wrapper, wrap MockUSDC
                                        into cUSDC directly to the pool. [R4]
```

Using Zama's published mock also satisfies the brief's **"provide a faucet or clear instructions"** requirement — judges
mint the underlying directly. One fewer contract, one fewer deploy step.

**[R4] The funding bridge and the solvency guard.** Revision 3 credited `pendingPrize` as an encrypted number but never
said how real cUSDC reaches the pool. It arrives through the wrapper: `fundEpoch()` approves `0x7c5B…3639` and wraps
plaintext MockUSDC straight to the pool. The plaintext ERC-20 path is deliberate — `transferFrom` **reverts** on a
shortfall, so funding fails loudly, whereas `confidentialTransfer` would return an encrypted zero we could not check,
silently underfunding the pool and paying the winner nothing.

`closeEpoch()` then reverts unless `prizeFunded[epoch]`. That single plaintext guard is sufficient, because principal is
self-balancing (§6.4) and ticket ranges are disjoint covering `[0, total)`, so at most one claimant is ever in range and
total prize credit can never exceed `prizeAmount[epoch]` — a plaintext `uint64`, already public per §3.

### 6.1 `TenurePool.sol`

```solidity
struct Account {
  euint64 balance;
  euint64 pendingPrize; // separate handle — brief requires a claim step
  uint32 depositEpoch;
  uint32 ladderIndex;
  bool enrolled;
}
```

- **`deposit`** — user first calls `setOperator(pool, until)` on cUSDC. **ERC-7984 uses operators, not ERC-20
  approvals** — the frontend must make this distinction explicit or users will be confused by a step that looks like an
  approval but isn't one. Then submits encrypted amount plus input proof; pool pulls via `confidentialTransferFrom`.
- **`withdraw`** — clamps with `FHESafeMath.tryDecrease`, transfers out, resets tier. Callable in **every** draw state.
  Principal is never locked by draw machinery.
- **`claim`** — see §6.2.

**[R4] Participant registry.** `address[] participants` is append-only and never compacted, so indices are permanently
stable. `closeEpoch` snapshots `epochParticipantCount[epoch]`; `buildChunk` walks
`[cursor, min(cursor + LADDER_CHUNK, snapshot))`. Deposits made during `LADDER_BUILD` append past the snapshot and are
invisible this epoch — which is exactly the §9 anti-gaming rule, now index-safe. Ineligible or zero-balance accounts
receive weight 0 (an empty rung, `start == end`, unwinnable) rather than being skipped, which is what preserves index
stability.

**[R4] Overflow guard — the aggregate, not just the account.** §4's per-account cap is not sufficient alone; the _ladder
total_ is what wraps.

```
MAX_ACCOUNT_BALANCE = 1e12    (1,000,000 cUSDC at 6 decimals)
MAX_PARTICIPANTS    = 10,000
worst case: 1e12 x 8 x 1e4 = 8e16  <<  2^64 ~= 1.8446e19    (~230x headroom)
```

Enforced on deposit with `FHE.le` + `FHE.select` (~174k HCU), asserted in tests.

**Silent-failure discipline.** `confidentialTransferFrom` returns an **encrypted zero on insufficient balance rather
than reverting** (confirmed in OpenZeppelin's audit). Capture the returned `euint64` at every call site and treat it as
authoritative. Never assume the requested amount moved. This is the most common bug class in confidential token
integrations.

### 6.2 **[R3]** Claim-time winner evaluation

Replaces chunked settlement entirely. This is how PoolTogether V5 works and it is what a Season 4 builder has already
asked Zama about on the forum.

```solidity
function claimPrize(uint32 epoch) external {
  // one user, one transaction, ~350k HCU total
  ebool inRange = FHE.and(
    FHE.le(rung.start, W), // W is plaintext → scalar comparison
    FHE.gt(rung.end, W)
  );
  euint64 award = FHE.select(inRange, FHE.asEuint64(prize), ZERO);
  account.pendingPrize = FHE.add(account.pendingPrize, award);
  FHE.allow(account.pendingPrize, msg.sender);
}
```

- Non-winners receive an encrypted zero. Calling `claimPrize` reveals nothing about the outcome.
- The user then decrypts `pendingPrize` via EIP-712 to learn whether they won — **this is exactly the flow the brief
  asks for**: "Claim: Decrypt and claim winnings via the EIP-712 user-decryption flow."
- `withdrawPrize` moves `pendingPrize` into `balance`.

**Why this is strictly better than chunked settlement:** unbounded participants, no HCU cliff, no settle cursor, no
keeper needed for payout, and the claimant pays their own gas. It removes an entire state from the machine.

**Unclaimed prize handling.** Each epoch's prize has a claim window. After expiry, anyone may call `rollover(epoch)` and
the prize folds into the next epoch. No prize is ever stranded.

### 6.3 `DrawEngine.sol`

**[R4]** Self-relaying state machine, five states:

```
OPEN --closeEpoch()---------------------------> LADDER_BUILD
  requires prizeFunded[epoch]; snapshots participant count;
  zero participants -> rollover, state stays OPEN

LADDER_BUILD --buildChunk() x ceil(N/20)------> TOTAL_PENDING
  final chunk calls FHE.makePubliclyDecryptable(total)

TOTAL_PENDING --submitTotal(clear, proof)-----> WINNER_PENDING
  FHE.checkSignatures -> plaintext total
  total == 0 -> abort to OPEN, rollover
  else r = FHE.randEuint64(); W = FHE.rem(r, total);
       FHE.makePubliclyDecryptable(W)

WINNER_PENDING --submitWinner(clear, proof)---> CLAIMABLE
  FHE.checkSignatures -> plaintext W

CLAIMABLE --window expires--------------------> OPEN
  unclaimed prize rolls forward
```

Ladder build, per participant:

```
weight  = FHE.shl(balance_i, tierShift_i)     // 34k, branches off the chain
start_i = runningTotal
end_i   = FHE.add(runningTotal, weight)       // 162k, the sequential chain
```

**[R4] The draw is merged into `submitTotal`.** Revision 3 drew a separate `AWAITING_TOTAL` state and a `drawSeed()`
call. Since randomness can only be drawn once the plaintext total exists, doing both in one transaction removes a state
and a stall point.

All phase-advancing functions are **permissionless**, and — because the deprecated `requestDecryption` was what carried
`msg.value` — **no caller needs to send value**. This satisfies "automate draws, or provide a documented keeper/admin
flow." Ship a keeper script; document manual triggering as the fallback.

### 6.4 **[R4]** Error recovery — a scored criterion

Season 3 winners were publicly challenged for having no recovery path when an unwrap failed, leaving funds stuck
permanently. Do not repeat that. Every path that can stall has an escape:

| Failure                                     | Recovery                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Nobody submits a decryption (either round)  | `abortDraw()` after timeout, permissionless. Prize rolls forward, state -> OPEN |
| Ladder build stalls mid-chunk               | Same `abortDraw()`; resets cursor, state -> OPEN                                |
| Epoch closed with zero participants         | `closeEpoch` rolls over without entering the machine                            |
| Weighted total decrypts to zero             | `submitTotal` aborts to OPEN and rolls over; `rem` never sees a zero divisor    |
| Duplicate or replayed decryption submission | No-op, guarded by state check; `checkSignatures` binds the proof to the handle  |
| Prize never claimed                         | `rollover(epoch)` after window expiry, permissionless                           |
| User claims twice for one epoch             | `hasClaimed[epoch][user]` guard, reverts cleanly                                |
| Epoch underfunded                           | Unreachable — `closeEpoch` reverts unless `prizeFunded[epoch]`                  |
| Withdrawal during any draw state            | Always permitted. Principal is never locked                                     |

**[R4]** `cancelDraw()` and `abortLadder()` are unified into a single `abortDraw()`. Every stall now has the same shape
— a state carrying a `stateEnteredAt` timestamp that nobody advanced. One function, one timeout, one test.

**Invariant to state loudly in the README:** no user action, decryption failure, or draw state can make principal
unrecoverable. Principal is **self-balancing** — `deposit` credits exactly the `euint64` returned by
`confidentialTransferFrom`, so recorded liability never exceeds cUSDC actually held.

### 6.5 **[R4]** Resolved: self-relaying. There is no callback path.

`FHE.requestDecryption` and `FHE.setDecryptionOracle` were **deprecated in v0.9 (October 2025)** — the changelog states
they "must be removed." The protocol is at v0.13.3. Revision 3's instruction to default to the callback path on timeout
was based on stale sources and is void.

The only supported flow is three-step self-relaying:

```
on-chain   FHE.makePubliclyDecryptable(handle)
off-chain  SDK publicDecrypt(handle) -> cleartext + proof
on-chain   FHE.checkSignatures(bytes32[] handlesList,
                               bytes    abiEncodedCleartexts,
                               bytes    decryptionProof)
```

Three consequences:

1. **No oracle liveness risk.** Nothing external must fire for the draw to complete; the machine stalls only if nobody
   chooses to advance it, which `abortDraw()` covers.
2. **No `msg.value` anywhere.** That was a `requestDecryption` affordance and it is gone.
3. **The keeper script is mandatory infrastructure**, not a convenience. Someone must fetch each decryption from the
   relayer and submit it on-chain. Budget it as a deliverable.

**The concrete API.** On-chain, the handle array is built with `FHE.toBytes32` and the cleartexts are `abi.encode`d in
matching order:

```solidity
// step 1, when the ladder completes
FHE.makePubliclyDecryptable(_encTotal);

// step 3, submitted by anyone
function submitTotal(uint64 clearTotal, bytes memory proof) external {
    bytes32[] memory handles = new bytes32[](1);
    handles[0] = FHE.toBytes32(_encTotal);
    FHE.checkSignatures(handles, abi.encode(clearTotal), proof);
    // total is now trusted plaintext; draw here
}
```

Off-chain, the keeper:

```ts
const results = await instance.publicDecrypt([handle]);
const clear = results.values[handle];
const proof = results.decryptionProof;
```

**[R4] Revision 3's handle-ordering warning is retired.** The proof is bound to handle order, but `submitTotal` and
`submitWinner` each decrypt **exactly one** handle, so both arrays are length 1 and ordering is trivially correct. Not a
hazard in this design; no defensive machinery needed.

---

## 7. **[R4]** The signature feature: public draw audit

Each S3 winner had one distinguishing feature. Ours is a **wallet-free draw audit** — anyone, with no wallet connected
and no transaction, can confirm a past draw was fair:

1. The randomness transaction, linked to Etherscan
2. The published total ticket count, and the transaction that revealed it
3. The published winning number `W`, and the transaction that revealed it
4. A plain-English statement of what this proves and what it deliberately does not reveal

**[R4] Shipped as a panel on the pool screen, not a `/verify/[epoch]` route.** Identical substance and the same thirty
seconds of video, without a second route or deploy surface; the route stays the obvious first extension. Verification
reads only existing on-chain data — no wallet, no signature, no relayer.

**[R4] This is the differentiator that survives the cut list, alongside tenure weighting.** The multiplier is ~10 lines
of `FHE.shl` and carries the whole thesis, so it is never the first thing to go. Revision 3's cut list had that
backwards.

Most competitors will claim verifiability in prose; we make it clickable.

---

## 8. Frontend

Next.js on Vercel. `@zama-fhe/react-sdk` + `@zama-fhe/sdk` (peer) + `@tanstack/react-query`. The **[R4] Versions
verified against the registry and pinned:** `@zama-fhe/sdk@3.5.1`, `@zama-fhe/react-sdk@3.5.1`,
`@fhevm/solidity@0.13.3`, `@fhevm/hardhat-plugin@0.4.2`, `@openzeppelin/confidential-contracts@0.5.3`. Revision 3
flagged these namespaces as uncertain; all exist as named. The legacy `@zama-fhe/relayer-sdk@0.4.4` also remains
published and holds the low-level primitives if the hooks fight us. Do not trust tutorial imports.

**WASM is the deployment risk.** `tfhe_bg.wasm` must load client-side only. Vite is clean; Webpack commonly fails with
`Cannot read properties of undefined (reading '__wbindgen_malloc')` or silently degrades. Dynamic import behind
`"use client"`, never initialise during SSR, and assert at runtime that `createEncryptedInput` exists — throw loudly
rather than half-work.

**Screens [R4]:** Pool (carrying the wallet-free draw-audit panel, §7) · Your position (tier and multiplier prominent) ·
Deposit/withdraw/claim.

**[R4] Cut from the submission:** the draw-history screen and the `/verify/[epoch]` route. Etherscan links cover
history. Both are README future work.

**Permit UX.** Gate the first EIP-712 prompt behind an explicit "View balance" button. The session signature caches, so
later decryptions don't re-prompt.

**Error states — explicitly judged.** Distinct, human messages for: missing operator approval, insufficient balance,
wrong network, unsupported token, relayer unreachable, WASM load failure, decryption pending, claim window closed,
already claimed.

---

## 9. Anti-gaming

| Attack                                | Defence                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| Deposit right before draw             | Tier 0 → 1× against long-holders' 8×                            |
| Deposit during ladder build           | `depositEpoch = current + 1`; excluded from this epoch          |
| Hold dust, then deposit large         | Any deposit resets tier                                         |
| Withdraw/redeposit to game tiers      | Withdrawal resets tier                                          |
| Observe pool to time entry            | Balances encrypted; only weighted aggregate visible             |
| Manipulate randomness via draw timing | Protocol randomness, not caller-influenced; total already fixed |
| Grief by never advancing state        | Permissionless phases; timeouts on every awaiting state         |
| Sybil-split across addresses          | No benefit — odds linear in balance, each address starts tier 0 |

---

## 10. Deliberately not built

- True per-block TWAB — epoch-granular tenure achieves the same economic goal far cheaper
- Multiple winners / prize tiers — single winner per epoch
- `FHE.sum` ladder optimisation — **[R4] not applicable**, not merely deferred: it yields one total, never the prefix
  sums the ladder needs (§5)
- `/verify/[epoch]` route — **[R4]** folded into a wallet-free panel on the pool screen (§7)
- Draw-history screen — **[R4]** Etherscan links cover it
- Mobile responsiveness — **[R4]** desktop only for the submission
- Append-only ladder avoiding the O(N) rebuild — introduces dead-range compaction
- Real yield source — brief explicitly permits an admin-funded reserve
- Upgradeability — immutable for the submission

Stating scope cuts with reasons is a production-quality signal. Hiding them is not.
