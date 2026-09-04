import Link from "next/link";

import { Nav } from "@/components/Nav";
import { Ladder } from "@/components/Ladder";
import { Reveal, HeroChoreography } from "@/components/Reveal";
import { readDrawState, type DrawState } from "@/lib/chain";
import { ADDRESSES, PHASE_LABELS, addressUrl, formatUnits6, shorten } from "@/lib/config";

export const revalidate = 15;

function Stat({ label, value, tone = "clear" }: { label: string; value: string; tone?: "clear" | "glow" | "muted" }) {
  const toneClass = tone === "glow" ? "text-glow" : tone === "muted" ? "text-muted" : "text-clear";
  return (
    <div className="hairline pt-3">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1.5 font-mono text-[0.9375rem] tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

function Step({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <div className="hairline pt-5">
      <span className="section-index">{index}</span>
      <h3 className="display mt-3 text-[1.375rem] text-clear">{title}</h3>
      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/**
 * Tenure made visible: low tiers are diffuse, high tiers resolve into focus.
 *
 * The blur is applied to a decorative bar, never to the multiplier itself. Fading or blurring the
 * value would put real content below the contrast floor — gold at reduced opacity on paper lands
 * around 3:1 — and no amount of tuning fixes that while still reading as "unresolved". The bar
 * carries the metaphor; the number stays fully legible.
 */
function TierRow({
  tier,
  held,
  multiplier,
  odds,
  blur,
}: {
  tier: string;
  held: string;
  multiplier: string;
  /** Bar width as a percentage, proportional to the multiplier. */
  odds: number;
  blur: string;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-line py-4 sm:gap-6">
      <span className="w-10 shrink-0 font-mono text-[0.6875rem] text-muted-dim">{tier}</span>
      <span className="w-24 shrink-0 text-sm text-muted sm:w-40">{held}</span>
      <span className="w-14 shrink-0 font-mono text-2xl tabular-nums text-glow sm:text-3xl">{multiplier}</span>
      <span aria-hidden className="hidden min-w-0 flex-1 sm:block">
        <span className={`block h-2 rounded-[1px] bg-glow-bright ${blur}`} style={{ width: `${odds}%` }} />
      </span>
    </div>
  );
}

export default async function Home() {
  let state: DrawState | null = null;
  let readError: string | null = null;

  try {
    state = await readDrawState();
  } catch (error) {
    const e = error as { shortMessage?: string; message?: string };
    readError = e.shortMessage ?? e.message ?? String(error);
  }

  const drawn = Boolean(state && state.totalTickets > 0n && state.drawnEpoch !== null);

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
        {/* ─────────────────────────────────────────────── 01 hero ── */}
        <HeroChoreography>
          <section className="pt-32 sm:pt-40">
            <p data-hero-eyebrow>
              <span className="section-index">01</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">Confidential prize savings</span>
            </p>

            <h1 className="display mt-7 text-[clamp(2.75rem,9vw,5.5rem)]">
              <span data-hero-line className="block">
                Hold longer.
              </span>
              <span data-hero-line className="block text-muted">
                Win quieter.
              </span>
            </h1>

            <p data-hero-copy className="mt-7 max-w-[54ch] text-[1.0625rem] leading-relaxed text-muted">
              Deposit into a shared pool and the yield is drawn as a prize. Your balance is stored as ciphertext, your
              odds rise the longer you hold, and your principal is never locked. Anyone can verify the draw was fair.
              Nobody can work out who won.
            </p>

            <div data-hero-actions className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn btn-primary">
                Enter the pool
                <span aria-hidden>→</span>
              </Link>
              <Link href="#how" className="btn btn-ghost">
                How a draw works
                <span aria-hidden>↓</span>
              </Link>
            </div>

            <div
              data-hero-proof
              className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-dim"
            >
              <span>Live on Sepolia</span>
              <span aria-hidden className="text-line-bright">
                /
              </span>
              <span>Etherscan verified</span>
              <span aria-hidden className="text-line-bright">
                /
              </span>
              <span>33 tests green</span>
              <span aria-hidden className="text-line-bright">
                /
              </span>
              <span>No wallet needed to audit</span>
            </div>
          </section>

          {/* ────────────────────────────────────── live draw panel ── */}
          <section data-hero-panel className="mt-20">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">
                {state ? `Live · epoch ${state.currentEpoch} · ${PHASE_LABELS[state.phase] ?? "unknown"}` : "Live pool"}
              </p>
              <a
                href={addressUrl(ADDRESSES.pool)}
                className="font-mono text-[0.6875rem] text-muted underline-offset-4 transition-colors hover:text-glow hover:underline"
              >
                Verify on Etherscan
              </a>
            </div>

            {readError || !state ? (
              <div className="panel mt-6 p-6">
                <p className="eyebrow">Chain unreachable</p>
                <p className="mt-2.5 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted">
                  The public Sepolia endpoint did not respond, so this draw cannot be shown right now. The contracts are
                  unaffected and the pool is still live. Reload in a moment.
                </p>
              </div>
            ) : (
              <>
                <Ladder
                  total={state.totalTickets}
                  winningNumber={state.winningNumber}
                  drawn={drawn}
                  epoch={state.drawnEpoch}
                />

                <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                  <Stat
                    label="weighted total"
                    value={state.totalTickets > 0n ? state.totalTickets.toLocaleString("en-US") : "—"}
                  />
                  <Stat label="winning number" value={drawn ? state.winningNumber.toLocaleString("en-US") : "—"} />
                  <Stat label="prize pool" value={`${formatUnits6(state.prizeAmount)} cUSDC`} tone="glow" />
                  <Stat label="savers" value={state.participantCount.toString()} />
                </dl>
              </>
            )}
          </section>
        </HeroChoreography>

        {/* ──────────────────────────────────────── 02 the problem ── */}
        <Reveal as="section" className="mt-32 sm:mt-40">
          <p>
            <span className="section-index">02</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">The problem</span>
          </p>
          <h2 className="display mt-6 max-w-[18ch] text-[clamp(2rem,5vw,3.25rem)]">
            Public balances make prize savings easy to game.
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              On a transparent chain, every deposit and every balance is readable. So capital watches the pool, arrives
              a block before the draw, takes odds proportional to a balance it held for minutes, and leaves immediately
              after. It collects lottery odds without ever really saving.
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              The people who actually save pay for that. PoolTogether needed a time-weighted balance to survive it, and
              even then the strategy is visible to anyone willing to read the chain. Tenure removes both halves of the
              problem: the information the sniper reads, and the payoff they read it for.
            </p>
          </div>
        </Reveal>

        {/* ─────────────────────────────────── 03 how a draw works ── */}
        <Reveal as="section" id="how" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">03</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">How a draw works</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(2rem,5vw,3.25rem)]">
            Four moves, and only two of them are public.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
            Nothing here asks you to trust an operator with a number. Every phase can be advanced by anyone, and every
            phase that can stall has a timeout that anyone can trigger.
          </p>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <Step index="01" title="Deposit">
              Your amount is encrypted in the browser before it reaches the chain, and stays a ciphertext balance from
              the moment it lands. It is withdrawable in every phase of every draw. There is no lock-up.
            </Step>
            <Step index="02" title="Build the ladder">
              Each saver is given a ticket range whose width is their balance, shifted by their tenure tier. The ranges
              are computed over ciphertext, in batches, so the pool is not capped by what fits in one transaction.
            </Step>
            <Step index="03" title="Draw">
              The protocol generates randomness on-chain and reduces it against the published total. The winning number
              becomes public. Every ticket range stays encrypted, so the number cannot be traced to a person.
            </Step>
            <Step index="04" title="Claim">
              Everyone claims the same way and everyone receives an encrypted result, so claiming reveals nothing. You
              decrypt your own outcome with your own signature, and disclose it only if you want to.
            </Step>
          </div>
        </Reveal>

        {/* ────────────────────────────────── 04 what stays private ── */}
        <Reveal as="section" id="privacy" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">04</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">What stays private</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(2rem,5vw,3.25rem)]">
            The boundary, stated plainly.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
            Confidentiality claims are easy to make and hard to keep once money moves. This is the exact line, including
            the parts that are less flattering.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Public — anyone can check</p>
              <ul className="mt-4 space-y-3 text-[0.9375rem] text-clear">
                <li className="hairline pt-3">The weighted ticket total for each epoch</li>
                <li className="hairline pt-3">The winning ticket number</li>
                <li className="hairline pt-3">The prize amount and the epoch schedule</li>
                <li className="hairline pt-3">That an address participated at all</li>
              </ul>
            </div>
            <div>
              <p className="eyebrow !text-glow">Encrypted — only you can read</p>
              <ul className="mt-4 space-y-3 text-[0.9375rem] text-clear">
                <li className="hairline pt-3">Every individual balance</li>
                <li className="hairline pt-3">Every individual ticket range</li>
                <li className="hairline pt-3">Every pending prize, won or not</li>
                <li className="hairline pt-3">Who the winner is</li>
              </ul>
            </div>
          </div>

          <div className="panel mt-12 p-6 sm:p-8">
            <p className="eyebrow">What still leaks</p>
            <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed text-muted">
              Participation is visible even though amounts are not. The weighted total loosely bounds how much is in the
              pool. With very few savers, an observer who already knows some balances can narrow the field — that is
              true of any pool. And because awards are encrypted, the contract itself cannot tell a winning claim from a
              losing one, which is why an unclaimed prize only rolls forward when nobody claimed at all.
            </p>
          </div>
        </Reveal>

        {/* ──────────────────────────────────────────── 05 tenure ── */}
        <Reveal as="section" className="mt-28 sm:mt-36">
          <p>
            <span className="section-index">05</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">Tenure</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(2rem,5vw,3.25rem)]">
            Odds that come into focus.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
            Encryption removes what the sniper reads. Tenure removes what they read it for. Hold across an epoch
            boundary and your odds double; hold four and they are eight times what they started at. Any deposit or
            withdrawal resets you to the beginning, so there is no way to hold dust and then arrive large.
          </p>

          <div className="mt-12">
            <TierRow tier="tier 0" held="new this epoch" multiplier="1×" odds={12.5} blur="resolve-0" />
            <TierRow tier="tier 1" held="held one epoch" multiplier="2×" odds={25} blur="resolve-1" />
            <TierRow tier="tier 2" held="held two to three" multiplier="4×" odds={50} blur="resolve-2" />
            <TierRow tier="tier 3" held="held four or more" multiplier="8×" odds={100} blur="resolve-3" />
          </div>

          <p className="mt-8 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
            The multiplier is a deployment parameter rather than a rule baked into the contract. Set every tier to the
            same value and Tenure reduces exactly to strict deposit-weighting — canonical PoolTogether — which is
            asserted in the test suite rather than merely claimed here.
          </p>
        </Reveal>

        {/* ────────────────────────────────── 06 built like infra ── */}
        <Reveal as="section" stagger className="mt-28 sm:mt-36">
          <p>
            <span className="section-index">06</span>
            <span aria-hidden className="mx-2.5 text-line-bright">·</span>
            <span className="eyebrow">Built like infrastructure</span>
          </p>
          <h2 className="display mt-6 max-w-[22ch] text-[clamp(2rem,5vw,3.25rem)]">
            A savings protocol should be boring everywhere except the draw.
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="hairline pt-5">
              <h3 className="text-[1.0625rem] text-clear">Principal is never locked</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                Withdrawal works in all five phases of a draw, including while the ladder is being built and while a
                claim window is open. There is a test that fails loudly if that stops being true.
              </p>
            </div>
            <div className="hairline pt-5">
              <h3 className="text-[1.0625rem] text-clear">No operator to wait on</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                Every phase advances permissionlessly and none require a payment. Whoever pushes the machine forward
                chooses the timing, never the outcome. If nobody does, a timeout releases it.
              </p>
            </div>
            <div className="hairline pt-5">
              <h3 className="text-[1.0625rem] text-clear">Nothing can strand funds</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                A draw cannot start unless its prize is already funded, so a winner can never be credited from an empty
                pool. Every stall has an escape, and every escape rolls the prize forward.
              </p>
            </div>
          </div>
        </Reveal>

        {/* ──────────────────────────────────────────────── cta ── */}
        <Reveal as="section" className="mt-28 sm:mt-36">
          <div className="panel p-8 sm:p-12">
            <h2 className="display max-w-[16ch] text-[clamp(1.75rem,4vw,2.75rem)]">
              Try it on Sepolia. No real money, no sign-up.
            </h2>
            <p className="mt-5 max-w-[58ch] text-[0.9375rem] leading-relaxed text-muted">
              Mint the test token from the faucet built into the app, deposit an encrypted amount, and decrypt your own
              balance with a single signature. Everything above this line needed no wallet at all.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="btn btn-primary">
                Enter the pool
                <span aria-hidden>→</span>
              </Link>
              <a
                href="https://github.com/Sam-Rytech/Tenure"
                className="btn btn-ghost"
                target="_blank"
                rel="noreferrer noopener"
              >
                Read the code
              </a>
            </div>
          </div>
        </Reveal>

        {/* ───────────────────────────────────────────── footer ── */}
        <footer className="mt-24 hairline pt-8">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Deployed on Sepolia</p>
              <ul className="mt-4 space-y-2 font-mono text-xs text-muted">
                <li>
                  pool{" "}
                  <a
                    className="text-clear underline-offset-4 transition-colors hover:text-glow hover:underline"
                    href={addressUrl(ADDRESSES.pool)}
                  >
                    {shorten(ADDRESSES.pool, 10, 8)}
                  </a>
                </li>
                <li>
                  reserve{" "}
                  <a
                    className="text-clear underline-offset-4 transition-colors hover:text-glow hover:underline"
                    href={addressUrl(ADDRESSES.reserve)}
                  >
                    {shorten(ADDRESSES.reserve, 10, 8)}
                  </a>
                </li>
                <li>
                  cUSDC{" "}
                  <a
                    className="text-clear underline-offset-4 transition-colors hover:text-glow hover:underline"
                    href={addressUrl(ADDRESSES.cusdc)}
                  >
                    {shorten(ADDRESSES.cusdc, 10, 8)}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="eyebrow">About</p>
              <p className="mt-4 max-w-[46ch] text-xs leading-relaxed text-muted">
                Testnet only. Built on the Zama Protocol for the Zama Developer Program. Prizes come from an
                admin-funded reserve rather than a live yield source, which the brief permits; a real adapter plugs in
                behind the same function.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
