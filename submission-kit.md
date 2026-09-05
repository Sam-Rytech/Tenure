# Tenure — Submission Kit

Everything graded that isn't code. Write these on Day 1 in draft, finish on Day 2.

---

## 1. README structure

Winning submissions had deep READMEs. This is the outline; fill it as you build rather than at the end.

```
# Tenure — Confidential Prize Savings

> One-line pitch. Live demo link. Sepolia addresses.

## Try it
Live URL · how to get test tokens (mint from 0x9b5Cd...dFfF, wrap to cUSDC) ·
what to click, in order, to see the full cycle

## The problem
Prize savings gets sniped. Capital enters before a draw, claims odds proportional
to a balance held for minutes, exits after. Long-term savers subsidise it.
PoolTogether V5 needed TWAB to survive this.

## What Tenure does
Confidential TWAB. Balances encrypted; odds weighted by balance AND holding
duration. Confidentiality removes the sniper's information; tenure removes the payoff.

## How a draw works
Ladder → randomness → publish W → claim-time evaluation.
Include the state diagram from architecture.md §6.3.

## Confidentiality design
The privacy boundary table (architecture.md §3), verbatim.

## What leaks
The leakage list (architecture.md §3), verbatim. Do not soften it.
Judges asked for this explicitly; honesty here reads as competence.

## Verifying a draw yourself
Step-by-step, under five minutes, no wallet needed. The audit panel is the landing page itself.

## Why the design fits FHEVM's limits
HCU budget reasoning (architecture.md §5). Why the total is public.
Why tiers are powers of two. Why settlement happens at claim time.

## Error recovery
The recovery table (architecture.md §6.4).
State the invariant: no failure path can make principal unrecoverable.

## The yield mock
Admin-funded prize reserve, as the brief permits. How a real yield source
(Morpho vault, as in Zama's own Confidential Vault) plugs in behind fundPrize().

## Deployed addresses
All contracts, Sepolia, Etherscan-verified. Plus tx hashes from a real cycle.

## Local setup
One command to install, one to test, one to deploy.

## Future work
FHE.sum ladder optimisation · per-block TWAB · multiple prize tiers ·
append-only ladder · real yield adapter · upgradeability
```

---

## 2. Video script — target 2:45, hard cap 3:00

Real person, real voice, normal speed. **AI voice is disqualifying.** Subtitles are fine.

Rewritten against the app as built. The `/verify/[epoch]` route was cut; verification is a panel on the main page that
needs no wallet, which is actually a stronger demo because it is the first thing on screen. Live at
<https://tenure-psi.vercel.app>.

**Before recording.** Have two browser windows ready: one signed out, one with MetaMask on Sepolia holding a little test
ETH. Run a fresh draw first so the page shows a published winner, and keep the claim window (600s) in mind — there is
time to claim on camera, but not to dawdle.

**0:00–0:20 — The problem**

> "Prize savings pools have a flaw. Because everything on-chain is public, people watch the pool, deposit right before
> the draw, take the odds, and withdraw straight after. They get lottery odds without ever really saving — and the
> people who actually save are quietly paying for it."

**0:20–0:45 — The idea, on the ladder**

Open the live site, signed out. Let the ladder sit on screen.

> "This is Tenure. Every ticket range in that band is encrypted. The number above it is the winning ticket, and it's
> public — anyone can check the draw was fair. But there are no divisions drawn in the band, because nobody can read
> where one person's range ends and the next begins. So the draw is verifiable and the winner is not identifiable, at
> the same time."

Point out that no wallet is connected. That is the whole point of this screen.

**0:45–1:35 — Live: deposit and reveal**

Switch to the wallet window. Get test cUSDC, grant the pool operator rights, deposit an amount.

> "I'll get some test tokens and deposit. Notice this step — confidential tokens use operators, not approvals, so it
> looks like an approval but it isn't one. My deposit amount is encrypted in the browser before it ever reaches the
> chain."

Then press Reveal my balance and sign.

> "On-chain that balance is ciphertext. Nobody can read it — not other users, not me from another account, not the
> contract itself. I sign once, and only I can decrypt my own number."

**1:35–2:15 — Live: the draw and the private result**

Show the published total and winning number, then claim.

> "The randomness is generated on-chain and reduced against a total published before the draw. The winning number lands
> somewhere on that axis. I claim — and everybody who claims gets an encrypted result, so claiming reveals nothing about
> whether you won. I decrypt mine privately to find out."

If the demo account won, reveal the prize. If not, say so plainly — an honest zero is a better demonstration than a
staged win, because it shows non-winners learn nothing either.

**2:15–2:35 — Tenure, and getting out**

> "Odds also scale with how long you hold: one times, then two, four, and eight. Any deposit or withdrawal resets you.
> That's what makes sniping pointless even if you try it — it's PoolTogether's time-weighted model, done over encrypted
> balances."

Withdraw principal.

> "And principal comes out whenever I want, in any phase of the draw. It's no-loss: you only ever gamble the prize."

**2:35–2:45 — Close**

> "Balances private, fairness public, and odds that reward actually saving. Live on Sepolia, code and addresses in the
> description."

**Recording notes.** Script it, read it once aloud for timing, then record. Expect three or four takes. Capture screen
and voice separately if that is easier. The relayer is occasionally slow, so if an encryption or decryption hangs for a
few seconds, keep talking — it is honest, and cutting to a frozen spinner looks worse than narrating it.

---

## 3. X thread

Tag `@zama`, use `#ZamaDeveloperProgram`. Numbers below are from the real recorded draw.

**1/**

> Prize savings pools have a flaw nobody talks about.
>
> Because balances are public, people deposit right before the draw, take the odds, and withdraw right after. The people
> actually saving subsidise them.
>
> We built Tenure to fix it. 🧵

**2/**

> Tenure is a confidential no-loss prize pool on @zama's FHEVM.
>
> Deposit, earn a shot at the prize, withdraw your principal whenever. You only ever gamble the prize — never your
> savings.

**3/**

> Your balance lives on-chain as ciphertext. Not hidden behind a UI. Actually encrypted.
>
> That removes the information snipers depend on. They can't see the pool to time their entry.

**4/**

> Then odds scale with how long you've held: 1× → 2× → 4× → 8×. Any deposit or withdrawal resets you.
>
> It's PoolTogether V5's time-weighted model implemented over encrypted balances. Sniping stops paying even if you try.

**5/**

> The hard part: how do you prove a draw was fair when every balance is secret?
>
> We publish the winning ticket number. We keep every participant's ticket range encrypted.
>
> Anyone can verify the draw. Nobody can identify the winner.

**6/**

> Here's a real one. 1,000,000 of deposits — but the published weighted total is 8,000,000, because every saver had held
> long enough to reach the top 8x tier. Winning number 523,794.
>
> You can check that number landed correctly. You cannot tell whose range it landed in — the winner found out by
> decrypting their own prize with an EIP-712 signature.
>
> Not even the contract paying out knows who it paid.

**7/**

> Every waiting phase has a timeout anyone can trigger, and principal is withdrawable in every phase of the draw.
>
> No failure path can make your deposit unrecoverable. That was a design requirement, not an afterthought.

**8/**

> Verify a draw yourself, no wallet needed: https://tenure-psi.vercel.app
>
> Code: https://github.com/Sam-Rytech/Tenure
>
> Built for #ZamaDeveloperProgram Season 4.

---

## 4. Final checklist

Status as of the current build. Ticked items are verified, not assumed.

- [x] Public GitHub repo, open source — <https://github.com/Sam-Rytech/Tenure>
- [x] Live URL — <https://tenure-psi.vercel.app>, reading Sepolia server-side
- [x] Full cycle on-chain: deposit → draw → claim → withdraw, all 45 hashes in `docs/cycle-sepolia.json`
- [x] Balances encrypted throughout
- [x] On-chain FHE randomness, weighted, over encrypted balances
- [x] Principal withdrawable at any time — tested in all five draw phases
- [x] Documented keeper/admin draw trigger — `scripts/live-cycle.ts`
- [x] EIP-712 decryption of balance **and** winnings
- [x] Faucet instructions — Zama's public mint, wired into the UI
- [x] Contracts verified on Etherscan
- [x] README complete per §1
- [ ] **Final redeploy + fresh cycle** — contracts are ahead of the deployed bytecode; needs Sepolia ETH
- [ ] **Video** — ≤3 min, real person, normal speed. Script in §2
- [ ] **X thread published** — drafted in §3
- [ ] **Submitted**

### What is deliberately not in the submission

Stated so the omissions read as decisions rather than gaps: the `/verify/[epoch]` route (folded into the landing page),
a draw-history screen (Etherscan covers it), mobile layout, fuzz tests, and the `FHE.sum` ladder optimisation, which
turns out to be inapplicable rather than merely deferred — it yields one total, and the ladder needs prefix sums.
