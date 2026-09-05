import { Nav } from "@/components/Nav";
import { Ladder } from "@/components/Ladder";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal, HeroChoreography } from "@/components/Reveal";
import { ShaderBackground } from "@/components/ui/shader-background";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { readDrawState, type DrawState } from "@/lib/chain";
import { ADDRESSES, PHASE_LABELS, addressUrl, formatUnits6 } from "@/lib/config";

export const revalidate = 15;

function Stat({ label, value, tone = "clear" }: { label: string; value: string; tone?: "clear" | "glow" | "muted" }) {
  const toneClass = tone === "glow" ? "text-glow" : tone === "muted" ? "text-muted" : "text-clear";
  return (
    <div className="hairline pt-3">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1.5 font-mono text-[0.875rem] tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

function Step({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <div className="hairline pt-5">
      <span className="section-index">{index}</span>
      <h3 className="display mt-3 text-[1.25rem] text-clear">{title}</h3>
      <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">{children}</p>
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
      <span className="w-24 shrink-0 text-[0.8125rem] text-muted sm:w-40">{held}</span>
      <span className="w-14 shrink-0 font-mono text-[1.375rem] tabular-nums text-glow sm:text-2xl">{multiplier}</span>
      <span aria-hidden className="hidden min-w-0 flex-1 sm:block">
        <span className={`block h-2 rounded-[1px] bg-glow-bright ${blur}`} style={{ width: `${odds}%` }} />
      </span>
    </div>
  );
}

/** One question and its answer. A details element, so the answers are searchable and printable. */
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1rem] text-clear">
        {q}
        <span
          aria-hidden
          className="shrink-0 font-mono text-[1.125rem] text-glow transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-3 max-w-[64ch] text-[0.875rem] leading-relaxed text-muted">{children}</p>
    </details>
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
        {/*
          The shader field sits behind the hero only. It breaks out of the max-width column to
          bleed full width, then fades back into flat paper so the panel has no visible edge.
        */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-full w-screen -translate-x-1/2"
          >
            <ShaderBackground />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-paper" />
          </div>

          <HeroChoreography>
            <section className="pt-32 sm:pt-40">
              <p data-hero-eyebrow>
                <span className="section-index">01</span>
                <span aria-hidden className="mx-2.5 text-line-bright">
                  ·
                </span>
                <span className="eyebrow">Confidential prize savings</span>
              </p>

              <h1 className="display mt-7 text-[clamp(2.5rem,8.2vw,5rem)]">
                <span data-hero-line className="block">
                  Hold longer.
                </span>
                <span data-hero-line className="block text-muted">
                  Win quieter.
                </span>
              </h1>

              <p data-hero-copy className="mt-7 max-w-[54ch] text-[1rem] leading-relaxed text-muted">
                Put money into a shared pool. The interest it earns is given away as a prize, so nobody loses their
                savings. Your balance is encrypted, your odds go up the longer you hold, and you can take your money out
                whenever you like. Anyone can check the draw was fair. Nobody can tell who won.
              </p>

              <div data-hero-actions className="mt-9 flex flex-wrap items-center gap-3">
                <InteractiveHoverButton href="/dashboard" text="Enter the pool" />
                <InteractiveHoverButton href="#how" text="How a draw works" variant="ghost" />
              </div>

              <div
                data-hero-proof
                className="over-field mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]"
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
            <section data-hero-panel id="pool" className="mt-20 scroll-mt-28">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow over-field">
                  {state
                    ? `Live · epoch ${state.currentEpoch} · ${PHASE_LABELS[state.phase] ?? "unknown"}`
                    : "Live pool"}
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
                  <p className="mt-2.5 max-w-[60ch] text-[0.875rem] leading-relaxed text-muted">
                    The public Sepolia endpoint did not respond, so this draw cannot be shown right now. The contracts
                    are unaffected and the pool is still live. Reload in a moment.
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
        </div>

        {/* ──────────────────────────────────────── 02 the problem ── */}
        <Reveal as="section" className="mt-32 sm:mt-40">
          <p>
            <span className="section-index">02</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">The problem</span>
          </p>
          <h2 className="display mt-6 max-w-[18ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            Public balances make prize savings easy to game.
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <p className="text-[0.875rem] leading-relaxed text-muted">
              On a normal blockchain everyone can read every balance. So a large holder waits, drops money in just
              before the draw, gets odds to match, and pulls it straight back out afterwards. They take the same chance
              of winning as someone who saved all year, without ever really saving.
            </p>
            <p className="text-[0.875rem] leading-relaxed text-muted">
              Real savers pay for that. Tenure takes away both halves of the problem at once: the balances they read,
              and the reward for reading them.
            </p>
          </div>
        </Reveal>

        {/* ─────────────────────────────────── 03 how a draw works ── */}
        <Reveal as="section" id="how" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">03</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">How a draw works</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            Four moves, and only two of them are public.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
            Nobody has to be trusted with the result. Anyone can push the draw to its next step, and if it ever gets
            stuck, anyone can reset it.
          </p>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <Step index="01" title="Deposit">
              Your amount is encrypted in your browser before it is sent, so the chain never sees the figure. You can
              withdraw at any point in any draw. Nothing is locked up.
            </Step>
            <Step index="02" title="Build the ladder">
              Everyone gets a range of ticket numbers as wide as their balance, stretched by how long they have held.
              This is worked out without ever decrypting anything, and in batches, so the pool can be any size.
            </Step>
            <Step index="03" title="Draw">
              A random number is drawn on-chain and published. Everyone&apos;s ticket range stays encrypted, so the
              number cannot be traced back to a person.
            </Step>
            <Step index="04" title="Claim">
              Everyone claims the same way and everyone gets an encrypted answer, so claiming gives nothing away. You
              decrypt your own result yourself, and tell people only if you want to.
            </Step>
          </div>
        </Reveal>

        {/* ────────────────────────────────── 04 what stays private ── */}
        <Reveal as="section" id="privacy" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">04</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">What stays private</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            The boundary, stated plainly.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
            Privacy is easy to promise and hard to keep once money moves. Here is the exact line, including the parts
            that do not flatter us.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Public — anyone can check</p>
              <ul className="mt-4 space-y-3 text-[0.875rem] text-clear">
                <li className="hairline pt-3">The weighted ticket total for each epoch</li>
                <li className="hairline pt-3">The winning ticket number</li>
                <li className="hairline pt-3">The prize amount and the epoch schedule</li>
                <li className="hairline pt-3">That an address participated at all</li>
              </ul>
            </div>
            <div>
              <p className="eyebrow !text-glow">Encrypted — only you can read</p>
              <ul className="mt-4 space-y-3 text-[0.875rem] text-clear">
                <li className="hairline pt-3">Every individual balance</li>
                <li className="hairline pt-3">Every individual ticket range</li>
                <li className="hairline pt-3">Every pending prize, won or not</li>
                <li className="hairline pt-3">Who the winner is</li>
              </ul>
            </div>
          </div>

          <div className="panel mt-12 p-6 sm:p-8">
            <p className="eyebrow">What still leaks</p>
            <p className="mt-3 max-w-[68ch] text-[0.875rem] leading-relaxed text-muted">
              Participation is visible even though amounts are not. The weighted total loosely bounds how much is in the
              pool. With very few savers, an observer who already knows some balances can narrow the field — that is
              true of any pool. And because awards are encrypted, the contract itself cannot tell a winning claim from a
              losing one, which is why an unclaimed prize only rolls forward when nobody claimed at all.
            </p>
          </div>
        </Reveal>

        {/* ──────────────────────────────────────────── 05 tenure ── */}
        <Reveal as="section" id="tenure" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">05</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">Tenure</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            Odds that come into focus.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
            Hold through one draw and your odds double. Hold through four and they are eight times what they started at.
            Any deposit or withdrawal puts you back to the start, so you cannot sit on small change for months and then
            turn up with a large balance.
          </p>

          <div className="mt-12">
            <TierRow tier="tier 0" held="new this epoch" multiplier="1×" odds={12.5} blur="resolve-0" />
            <TierRow tier="tier 1" held="held one epoch" multiplier="2×" odds={25} blur="resolve-1" />
            <TierRow tier="tier 2" held="held two to three" multiplier="4×" odds={50} blur="resolve-2" />
            <TierRow tier="tier 3" held="held four or more" multiplier="8×" odds={100} blur="resolve-3" />
          </div>

          <p className="mt-8 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
            The multipliers are a setting, not something welded into the contract. Make them all equal and Tenure
            behaves exactly like an ordinary prize pool. A test proves that, rather than us just saying it.
          </p>
        </Reveal>

        {/* ────────────────────────────────── 06 built like infra ── */}
        <Reveal as="section" stagger className="mt-28 sm:mt-36">
          <p>
            <span className="section-index">06</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">Built like infrastructure</span>
          </p>
          <h2 className="display mt-6 max-w-[22ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            A savings protocol should be boring everywhere except the draw.
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="hairline pt-5">
              <h3 className="text-[1rem] text-clear">Principal is never locked</h3>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">
                You can withdraw at every stage of a draw, no exceptions. A test fails loudly if that ever stops being
                true.
              </p>
            </div>
            <div className="hairline pt-5">
              <h3 className="text-[1rem] text-clear">No operator to wait on</h3>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">
                Anyone can move the draw along, and it costs nothing beyond gas. Whoever does it picks the timing, never
                the result. If nobody does, a timeout frees it.
              </p>
            </div>
            <div className="hairline pt-5">
              <h3 className="text-[1rem] text-clear">Nothing can strand funds</h3>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">
                A draw cannot start until its prize is already paid in, so a winner is never promised money that is not
                there. Every way of getting stuck has a way out, and each one carries the prize to the next draw.
              </p>
            </div>
          </div>
        </Reveal>

        {/* ──────────────────────────────────────────────── faq ── */}
        <Reveal as="section" id="faq" className="mt-28 scroll-mt-28 sm:mt-36">
          <p>
            <span className="section-index">07</span>
            <span aria-hidden className="mx-2.5 text-line-bright">
              ·
            </span>
            <span className="eyebrow">Questions</span>
          </p>
          <h2 className="display mt-6 max-w-[20ch] text-[clamp(1.875rem,4.6vw,2.9375rem)]">
            The things people ask first.
          </h2>

          <div className="mt-12">
            <Faq q="Can I lose my deposit?">
              No. The prize comes from a separate pot, not from anyone&apos;s savings, so not winning costs you nothing.
              Your money is yours the whole time and you can take it out at any point in a draw.
            </Faq>
            <Faq q="If the winning number is public, how is the winner hidden?">
              Because the ticket ranges are not public. The number tells you where it landed on a line whose sections
              are encrypted, so you can check the draw was honest without learning whose section it fell in.
            </Faq>
            <Faq q="Can the people who built this see my balance?">
              No. It is encrypted on-chain and only your own key can open it. The pool does arithmetic on it without
              ever decrypting it, which is the whole point of the technology underneath.
            </Faq>
            <Faq q="What is actually public, then?">
              That a draw happened, how much the prize was, the total number of tickets, the winning number, and which
              addresses took part. Amounts, individual ranges and results are not.
            </Faq>
            <Faq q="Why do my odds reset when I add money?">
              Otherwise you could hold a tiny balance for months to build up a multiplier, then top up to a large one
              right before a draw and get the best of both. Resetting is what closes that door.
            </Faq>
            <Faq q="Is this real money?">
              No. It runs on Sepolia, a test network, with test tokens you can mint for free. Nothing here is worth
              anything, and it has not been audited by anyone outside the project.
            </Faq>
            <Faq q="What if nobody runs the draw?">
              Anyone can run it, and it costs nothing but gas. If it stalls anyway, anyone can reset it after a timeout
              and the prize carries into the next draw. Your deposit is never caught up in it.
            </Faq>
          </div>
        </Reveal>

        {/* ──────────────────────────────────────────────── cta ── */}
        <Reveal as="section" className="mt-28 sm:mt-36">
          <div className="panel p-8 sm:p-12">
            <h2 className="display max-w-[16ch] text-[clamp(1.625rem,3.7vw,2.5rem)]">
              Try it on Sepolia. No real money, no sign-up.
            </h2>
            <p className="mt-5 max-w-[58ch] text-[0.875rem] leading-relaxed text-muted">
              Get the test token from the button in the app, deposit an encrypted amount, and read your own balance back
              with one signature. Everything above this line needed no wallet at all.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <InteractiveHoverButton href="/dashboard" text="Enter the pool" />
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

        <SiteFooter />
      </main>
    </>
  );
}
