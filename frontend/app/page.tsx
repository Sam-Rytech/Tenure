import { Ladder } from "@/components/Ladder";
import { WalletPanel } from "@/components/WalletPanel";
import { readDrawState, type DrawState } from "@/lib/chain";
import { ADDRESSES, PHASE_LABELS, addressUrl, formatUnits6, shorten } from "@/lib/config";

/** Chain state is cheap to read and changes on a human timescale. */
export const revalidate = 15;

function Fact({ label, value, seal = false }: { label: string; value: string; seal?: boolean }) {
  return (
    <div className="border-t border-ink-line pt-3">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`mt-1 font-mono text-base tabular-nums ${seal ? "text-seal" : "text-bone"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function Home() {
  let state: DrawState | null = null;
  let readError: string | null = null;

  try {
    state = await readDrawState();
  } catch (error) {
    const e = error as { shortMessage?: string; message?: string; cause?: { message?: string } };
    readError = e.shortMessage ?? e.message ?? String(error);
    console.error("[tenure] readDrawState failed:", readError.slice(0, 300), "| cause:", e.cause?.message?.slice(0, 300));
  }

  const drawn = Boolean(state && state.totalTickets > 0n && state.winningNumber >= 0n && state.drawnEpoch !== null);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24">
      <header className="flex items-baseline justify-between border-b border-ink-line py-6">
        <span className="display text-xl tracking-tight">Tenure</span>
        <span className="eyebrow">
          Sepolia{state ? ` · epoch ${state.currentEpoch}` : ""}
        </span>
      </header>

      <section className="pt-14">
        <h1 className="display text-[clamp(2.4rem,7vw,4.1rem)] max-w-[15ch]">
          Odds you can verify.
          <br />
          Balances nobody can read.
        </h1>
        <p className="mt-6 max-w-prose text-[1.0625rem] leading-relaxed text-bone-dim">
          A no-loss prize pool where every balance is stored as ciphertext and your odds rise the longer you hold. Your
          principal is never locked and never at risk — you only ever gamble the prize.
        </p>
      </section>

      <section className="pt-4">
        {readError ? (
          <div className="mt-10 rounded-[2px] border border-ink-line bg-ink-raised p-5">
            <p className="eyebrow">Chain unreachable</p>
            <p className="mt-2 text-sm leading-relaxed text-bone-dim">
              The public Sepolia endpoint did not respond, so this draw cannot be shown right now. The contracts are
              unaffected; reload in a moment.
            </p>
          </div>
        ) : (
          state && (
            <>
              <Ladder
                total={state.totalTickets}
                winningNumber={state.winningNumber}
                drawn={drawn}
                epoch={state.drawnEpoch}
              />

              <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                <Fact
                  label="weighted total"
                  value={state.totalTickets > 0n ? state.totalTickets.toLocaleString("en-US") : "—"}
                  seal={state.totalTickets > 0n}
                />
                <Fact
                  label="winning number"
                  value={drawn ? state.winningNumber.toLocaleString("en-US") : "—"}
                  seal={drawn}
                />
                <Fact label="prize" value={`${formatUnits6(state.prizeAmount)} cUSDC`} />
                <Fact label="participants" value={state.participantCount.toString()} />
                <Fact label="phase" value={PHASE_LABELS[state.phase] ?? "unknown"} />
                <Fact label="claims made" value={state.claimCount.toString()} />
                <Fact label="claim window" value={`${state.claimWindow.toString()}s`} />
                <Fact label="stall timeout" value={`${state.drawTimeout.toString()}s`} />
              </dl>
            </>
          )
        )}
      </section>

      <section className="mt-16 rule pt-8">
        <p className="eyebrow">What this proves</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <p className="text-sm leading-relaxed text-bone-dim">
            The randomness is generated on-chain by the protocol, reduced against a total that is published before the
            draw. Anyone can confirm the winning number was produced correctly and revealed honestly — no wallet, no
            signature, nothing to trust about us.
          </p>
          <p className="text-sm leading-relaxed text-bone-dim">
            What it deliberately does not prove is <em className="text-bone not-italic">who won</em>. Every ticket range
            is ciphertext, so the winning number cannot be traced to a participant. The winner finds out by decrypting
            their own prize, and nobody else can.
          </p>
        </div>
      </section>

      <WalletPanel />

      <footer className="mt-20 rule pt-6">
        <p className="eyebrow">Deployed on Sepolia</p>
        <ul className="mt-3 space-y-1.5 font-mono text-xs text-slate">
          <li>
            pool{" "}
            <a className="text-bone-dim underline underline-offset-2 hover:text-seal" href={addressUrl(ADDRESSES.pool)}>
              {shorten(ADDRESSES.pool, 10, 8)}
            </a>
          </li>
          <li>
            reserve{" "}
            <a
              className="text-bone-dim underline underline-offset-2 hover:text-seal"
              href={addressUrl(ADDRESSES.reserve)}
            >
              {shorten(ADDRESSES.reserve, 10, 8)}
            </a>
          </li>
          <li>
            cUSDC{" "}
            <a
              className="text-bone-dim underline underline-offset-2 hover:text-seal"
              href={addressUrl(ADDRESSES.cusdc)}
            >
              {shorten(ADDRESSES.cusdc, 10, 8)}
            </a>
          </li>
        </ul>
        <p className="mt-6 max-w-prose text-xs leading-relaxed text-slate">
          Testnet only. Built for the Zama Developer Program. Prize funds come from an admin-funded reserve rather than
          a yield source, which the brief permits.
        </p>
      </footer>
    </main>
  );
}
