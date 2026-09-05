# Tenure — Progress

**Deadline:** 6 Sep 2026, **12:00 UTC = 13:00 Lagos** **Now:** 3 Sep evening · **~56 hours remain** **Solo build** — I
write the code; you hold the wallet, the accounts, and the microphone.

> Revision 4. Two-developer split removed (the build is solo). Decryption flow resolved to self-relaying. Cut list
> pre-applied rather than held in reserve. Schedule re-sequenced around a single human bottleneck.

---

## Rules for the next 56 hours

1. **A working submission must exist by end of 5 Sep.** 6 Sep is buffer only.
2. **No new scope.** Anything discovered from here goes in the README as future work.
3. **The four assets are not optional:** live URL, README, video, X thread. A flawless contract with no live URL fails
   two judging criteria outright.
4. **If a block overruns by more than an hour, cut it.** The cut list is already applied; the next thing to go is the
   tenure multiplier, and only then.

---

## The division of labour

**Only you can do these.** Every one is a hard dependency on a human:

- MetaMask wallet + **Sepolia ETH** (faucets rate-limit — this is the long pole)
- Infura/Alchemy RPC key · Etherscan API key
- GitHub repo (public) · Vercel account
- Every deploy signature and every demo transaction
- The video: real person, real voice, normal speed. **AI voice is disqualifying.**

**I do everything else:** contracts, tests, keeper, frontend, README, scripts, X thread draft.

---

## Block 0 — tonight · YOU (~2h, parallel with Block 1)

- [ ] **Sepolia ETH first.** Faucets rate-limit; start here before anything else.
- [ ] Infura (or Alchemy) Sepolia RPC key
- [ ] Etherscan API key
- [ ] Public GitHub repo created
- [ ] Vercel account, connected to the repo

## Block 1 — tonight · ME (~2h)

- [x] Protocol research: decryption flow, package versions, HCU costs, token addresses
- [x] `architecture.md` Revision 4 applied
- [ ] `git init`, scaffold from `zama-ai/fhevm-hardhat-template`, pin exact versions
- [ ] Sample contract green in Hardhat mock mode
- [ ] Next.js placeholder ready to deploy
- [ ] **Gate: placeholder live on Vercel with WASM verified in the _production_ build**

## Block 2 — 4 Sep morning · ME

- [ ] `TenurePool.sol` — `Account` struct, deposit (operator flow, capture the returned `euint64`, aggregate cap),
      withdraw (`FHESafeMath.tryDecrease`, tier reset, callable in every state)
- [ ] Append-only participant registry with per-epoch snapshot
- [ ] `PrizeReserve.sol` + `fundEpoch()` wrap bridge + `prizeFunded` guard

## Block 3 — 4 Sep afternoon · ME

- [ ] `DrawEngine.sol` — five-state machine, chunked ladder (`LADDER_CHUNK = 20`)
- [ ] `submitTotal` / `submitWinner` with `FHE.checkSignatures`
- [ ] `abortDraw`, `rollover`, `claimPrize` / `withdrawPrize`, `hasClaimed` guard
- [ ] Keeper script (`publicDecrypt` → submit)
- [ ] Full cycle green in Hardhat mock mode
- [ ] **Gate: one real Sepolia cycle, 3+ participants, every tx hash recorded**

## Block 4 — 5 Sep morning · ME

- [ ] Frontend wired: deposit / withdraw / claim
- [ ] EIP-712 user decryption of balance **and** pending prize, behind an explicit button
- [ ] Pool screen + wallet-free draw-audit panel · position screen with tier and multiplier
- [ ] Nine error states with distinct human messages
- [ ] Tests: full cycle · withdrawal in every state · abort from each stall point · double-claim reverts · duplicate
      submission no-op · `[0,0,0,0]` reduces to deposit-weighting · cap holds · participant counts 19/20/21 across the
      chunk boundary

## Block 5 — 5 Sep afternoon · BOTH

- [ ] Verify contracts on Sepolia Etherscan
- [ ] **README** — see `submission-kit.md` §1. Leakage section verbatim, unsoftened.
- [ ] **Video** — ≤3 min, real voice. Script first, 3–4 takes. Deposit → decrypt → draw → claim → withdraw. **Recorded
      today, not on the 6th.**
- [ ] **X thread** — tag `@zama`, `#ZamaDeveloperProgram`
- [ ] Optional and cheap: a short Zama forum post introducing Tenure
- [ ] **Submit**

## Block 6 — 6 Sep before 12:00 UTC

Buffer only. Start nothing new.

---

## Cut list — already applied

| Cut                     | Replacement                                      |
| ----------------------- | ------------------------------------------------ |
| `/verify/[epoch]` route | Wallet-free audit panel on the pool screen       |
| Draw history screen     | Etherscan links                                  |
| Mobile responsiveness   | Desktop only, noted in README                    |
| Fuzz tests              | Cycle + boundary tests kept                      |
| `FHE.sum` optimisation  | Not applicable — yields a total, not prefix sums |

**Kept deliberately:** the tenure multiplier. ~10 lines of `FHE.shl`, and it carries the entire thesis. Revision 3
listed it as the first cut; that was backwards.

**Never cut:** live URL · one verified Sepolia cycle · README confidentiality and leakage section · error recovery paths
· video · X thread. Those six _are_ the submission.

---

## Risks

| Risk                                   | Mitigation                                          | Status                   |
| -------------------------------------- | --------------------------------------------------- | ------------------------ |
| No Sepolia ETH → nothing deploys       | Faucets started Block 0, before all else            | **OPEN — the long pole** |
| Decryption flow ambiguity              | Resolved: self-relaying, API verified               | **CLOSED**               |
| Package namespaces wrong               | All verified against the registry, pinned           | **CLOSED**               |
| WASM fails only in Vercel production   | Live placeholder in Block 1, not Block 5            | Open                     |
| HCU limits differ from published table | Re-validated; measure `ebool and` in Block 3        | Mostly closed            |
| Keeper never advances the machine      | `abortDraw()` timeout on every stall point          | Closed by design         |
| Video overruns or reads as AI          | Script it. Real voice. Normal speed. Record Block 5 | Open                     |
| Solo dev, no slack                     | Cut list pre-applied; multiplier is the next cut    | Open                     |

---

## Log

### 3 Sep

- **Decryption flow resolved as:** **self-relaying.** `FHE.requestDecryption` and `FHE.setDecryptionOracle` were
  deprecated in v0.9 and "must be removed"; protocol is at v0.13.3. Flow is `makePubliclyDecryptable` → SDK
  `publicDecrypt` → `FHE.checkSignatures`. No `msg.value` anywhere. Consequence: the keeper script is mandatory
  infrastructure, not a convenience.
- **Also corrected:** `rem` costs 1,153,000 HCU, not the 715k R3 quoted (that is `div`) — draw tx is 1,177,000, 24% of
  the depth ceiling. `claimPrize` ≈450k, not 350k. `FHE.sum` is inapplicable to a prefix-sum ladder. `LADDER_CHUNK = 20`
  re-validated at 3.24M depth.
- **Verified:** all package namespaces exist as guessed; both token addresses correct; `div`/`rem` are plaintext-divisor
  only; `randEuint64` bound must be a power of two.
- **Live URL:**
- **Blockers:** Sepolia ETH not yet obtained — blocks every deploy.

### 4 Sep

- **Sepolia deployment (live):** TenurePool `0x6c36d9b70954029D66032FEF2A4880b22a53AF9e`, PrizeReserve
  `0xd8701a0040032f3633E740Ce111dc50C3f84Bc79`. Both Etherscan-verified. Full 3-player draw completed: total 1,000,000,
  W 618,870, exactly one winner, all 45 steps in `docs/cycle-sepolia.json`.
- **Three live-only bugs found and fixed:** circular constructor dependency (undeployable); `CLAIM_WINDOW` hardcoded to
  3 days (undemonstrable); undici 10s connect timeout thrown from a timer callback (killed the process mid-cycle).
- **Verified, not assumed:** `setGlobalDispatcher` from node*modules undici \_does* control Node 22's built-in fetch —
  measured 2s/10s/20s against a blackhole address. Node issue #4215 does not apply here.
- **PENDING REDEPLOY.** The live instance predates the `MIN_WINDOW` constructor guard, so repo source is now ahead of
  the verified bytecode. Redeploy and re-run the cycle **once**, after the frontend is ready and ETH is topped up, then
  refresh the README addresses and hashes. Doing it now would waste a deploy.
- **Frontend built.** Next.js 16 + wagmi + @zama-fhe/react-sdk in `frontend/`. Production build passes. The draw-audit
  surface is a React Server Component reading Sepolia directly, so it renders with no wallet and no JS — the signature
  feature is the ticket ladder: a public axis with the winning number marked, over an unreadable ciphertext band with no
  divisions drawn, because none are knowable.
- **WASM risk was overstated.** SDK v3 loads FHE crypto from Zama's CDN in a Web Worker rather than bundling
  `tfhe_bg.wasm`, so the Webpack failure mode R3 feared does not apply. Zama's own template is Next.js.
- **Local dev cannot reach the chain**: the sandboxed dev-server process has no outbound network (a bare `fetch` to the
  RPC fails, while the same fetch works from plain node). Verified the viem client works standalone. Expect it to work
  on Vercel; confirm there.
- **Blockers:** Sepolia ETH low — 0.017 on the deployer, ~0.009 across helpers. Needs a top-up before the final deploy
  plus demo re-run.

### 5 Sep

- **Final deployment.** TenurePool `0x76012034adbcF3786798bf2b9C7972FA975bb339`, PrizeReserve
  `0x03cf9Dae9A39A34d9388de1EF16eE136F1507F2a`. Both Etherscan-verified. Frontend and README point at them; the repo and
  the deployed bytecode are back in sync.
- **Clean cycle recorded, and it now shows the differentiator.** All three savers had held an epoch, so the published
  total is 2,000,000 against 1,000,000 of stakes — the 2x tenure tier, visible on-chain. W 420,467 landed in the first
  range; claims decrypted to 1,000,000 / 0 / 0.
- **Two real bugs fixed getting there.** Decryption permits were anchored to the local clock, and a few seconds of skew
  made the relayer reject every user decryption with `validation_failed: requestValidity`; they are anchored to chain
  time now. And the keeper funded the prize once at startup, but finalizing an epoch advances the counter, so the next
  `closeEpoch` reverted with `PrizeNotFunded` — funding now happens immediately before each close.
- **Disk was full** (0 bytes of 238G). Cleared `frontend/.next` at 1.1GB and the npm cache at 2.2GB.
- **Fresh cycle for the recording, epoch 3.** Total 8,000,000 against 1,000,000 of deposits — every saver has now held
  across four boundaries, so the whole pool sits at the top 8x tier and the multiplier is as visible as it gets. W
  523,794, one winner, winner balance 2,300,000. README and thread carry these numbers.
- **The keeper died mid-claims** on a relayer connect timeout, after the draw was already published and p1 had claimed.
  Nothing on-chain was left inconsistent — the draw stands on its own — and the remaining claims were completed
  separately, so `docs/cycle-sepolia.json` records the whole run.
- **Docs, at `/docs`** — ten routes rather than one long page, with previous and next at the foot of each so it can be
  read straight through. Order and grouping live in one map that the sidebar, the jump menu and the pager all read, so
  they cannot drift apart when a page moves. Below the sidebar breakpoint the contents becomes a native `select` rather
  than a shrunken rail, inheriting the platform's picker and keyboard handling. Nothing animates in: the landing page
  argues, documentation gets read in a hurry, and content waiting on a scroll trigger is content that can fail to
  arrive.
- **Type scale down one notch** across every page — body 15px to 14px, headings and leads to match. The 11px and 12px
  tokens were left where they were, since that is the size their contrast was measured at.
- **Found while doing it:** the deposit amount input was 14px, and iOS Safari zooms the whole page when a field under
  16px takes focus. It holds 16px on phones now and only shrinks where there is a pointer.
- **The phone now renders the same scene as the desktop**, at lower resolution, instead of a reduced version of it.
  Three separate causes, none of which was the one it looked like: the dust grid was fixed in uv units, which are
  normalised to the _shorter_ edge — on a tall phone that is the width, so a phone drew the same motes at a third of the
  size and three times the count, and the field read as grain; the streak core is 0.0015 uv wide, which on a phone is
  under half a pixel, so the stars fell between sample points and crawled rather than moved; and the second dust layer
  and a third of the stars were simply switched off below 640px.
- **Fourteen stars everywhere, spread properly.** Their heights were being drawn from a hash, and fourteen samples of a
  hash do not have a distribution — they clump. Heights are stratified now: star `i` owns a band of the visible height
  and is jittered inside it. The spawn area is derived from the canvas rather than being a constant, which is what
  "concentrated in the centre" really was — a fixed band of half a unit covers a whole desktop hero but only the middle
  half of a phone's.
- **Faster than before despite all of it.** Every term that is identical for all fragments — the seeds, headings, phases
  and positions of all fourteen stars — was being recomputed for every pixel, roughly a hundred thousand times a frame.
  It moved to the CPU. Measured on this machine: 2.25ms a frame at the phone's configuration, against 2.68ms for the old
  one that had six stars and one dust layer.
- **Blockers:** none on my side. Remaining work is the video and publishing the thread. The phone rendering still needs
  checking on a real device; I can only measure it here.
