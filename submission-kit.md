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
Step-by-step, under five minutes, no wallet needed. Link /verify/[epoch].

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

**0:00–0:20 — The problem**

> "Prize savings pools have a flaw. Because everything on-chain is public, people watch the pool, deposit right before
> the draw, claim the odds, and withdraw straight after. They get lottery odds without ever really saving — and
> long-term depositors quietly pay for it."

**0:20–0:40 — The idea**

> "Tenure is a confidential version. Your balance is encrypted, so the information those snipers depend on doesn't
> exist. And your odds scale with how long you've held — one times at first, up to eight times after four periods. It's
> PoolTogether V5's time-weighted model, done over encrypted balances."

**0:40–1:30 — Live: deposit and decrypt** Screen recording. Connect wallet, mint, wrap, approve the pool as operator,
deposit an encrypted amount. Show the encrypted handle on-chain. Sign EIP-712, decrypt your own balance.

> "That's my balance on-chain — ciphertext. Nobody can read it, including the contract. I sign once, and only I can
> decrypt it."

**1:30–2:10 — Live: draw and claim** Trigger the draw. Show the published total and winning number.

> "The winning number is public — anyone can check the draw was fair. But every participant's ticket range is encrypted,
> so nobody can tell whose range it landed in. I claim, decrypt my prize, and find out privately."

**2:10–2:30 — Verify and withdraw** Open `/verify/[epoch]` without a wallet. Then withdraw principal.

> "Anyone can audit any draw here — no wallet needed. And principal comes out whenever I want. It's no-loss: you only
> ever gamble the prize."

**2:30–2:45 — Close**

> "Balances private, fairness public, and odds that reward actually saving. Live on Sepolia, link in the description."

**Recording notes:** script it, read it once aloud for timing, then record. Expect 3–4 takes. Do the screen capture
separately from the voice if that's easier. Record on Day 2, not Day 3.

---

## 3. X thread draft

Tag `@zama`, use `#ZamaDeveloperProgram`.

**1/**

> Prize savings pools have a flaw nobody talks about.
>
> Because balances are public, people deposit right before the draw, claim the odds, and withdraw right after. Real
> savers subsidise them.
>
> We built Tenure to fix it — with encryption. 🧵

**2/**

> Tenure is a confidential no-loss prize pool on @zama's FHEVM.
>
> Deposit, earn a shot at the prize, withdraw your principal whenever. You only ever gamble the yield — never your
> savings.

**3/**

> Your balance is stored on-chain as ciphertext. Not hidden behind a UI — actually encrypted.
>
> That removes the information the snipers depend on. They can't see the pool to time their entry.

**4/**

> Then we weight odds by how long you've held. 1× → 2× → 4× → 8×.
>
> This is PoolTogether V5's time-weighted model, implemented over encrypted balances. Sniping stops being profitable
> even if you try.

**5/**

> The hard part: how do you prove a draw was fair when every balance is secret?
>
> We publish the winning ticket number. We keep every participant's ticket range encrypted.
>
> Anyone can verify the draw. Nobody can identify the winner.

**6/**

> The winner finds out by decrypting their own prize with an EIP-712 signature.
>
> Not even the contract paying out knows who it paid.

**7/**

> Audit any draw yourself, no wallet needed: [verify link]
>
> Live on Sepolia: [demo link] Code: [repo link]
>
> Built for #ZamaDeveloperProgram Season 4.

---

## 4. Final checklist

- [ ] Public GitHub repo, open source
- [ ] Live URL, every feature usable on Sepolia
- [ ] Full cycle on-chain: deposit → draw → claim → withdraw
- [ ] Balances encrypted throughout
- [ ] On-chain FHE randomness, weighted, over encrypted balances
- [ ] Principal withdrawable at any time
- [ ] Documented keeper/admin draw trigger
- [ ] EIP-712 decryption of balance **and** winnings
- [ ] Faucet instructions
- [ ] README complete per §1
- [ ] Video ≤3 min, real person, normal speed
- [ ] X thread published
- [ ] Contracts verified on Etherscan
- [ ] Submitted
