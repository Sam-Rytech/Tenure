import Link from "next/link";

import { Nav } from "@/components/Nav";
import { Ladder } from "@/components/Ladder";
import { WalletPanel } from "@/components/WalletPanel";
import { readDrawState, type DrawState } from "@/lib/chain";
import { ADDRESSES, PHASE_LABELS, addressUrl, formatUnits6 } from "@/lib/config";

export const revalidate = 15;

export const metadata = {
  title: "Tenure — the pool",
  description: "Deposit, reveal your encrypted balance, claim, and withdraw. Sepolia testnet.",
};

function Stat({ label, value, tone = "clear" }: { label: string; value: string; tone?: "clear" | "glow" }) {
  return (
    <div className="hairline pt-3">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1.5 font-mono text-[0.9375rem] tabular-nums ${tone === "glow" ? "text-glow" : "text-clear"}`}>
        {value}
      </dd>
    </div>
  );
}

export default async function AppPage() {
  let state: DrawState | null = null;
  try {
    state = await readDrawState();
  } catch {
    state = null;
  }

  const drawn = Boolean(state && state.totalTickets > 0n && state.drawnEpoch !== null);

  return (
    <>
      <Nav cta={{ href: "/", label: "Back to overview" }} />

      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <p>
          <span className="eyebrow">
            {state ? `Epoch ${state.currentEpoch} · ${PHASE_LABELS[state.phase] ?? "unknown"}` : "Sepolia"}
          </span>
        </p>
        <h1 className="display mt-5 text-[clamp(2.25rem,6vw,3.25rem)]">The pool</h1>
        <p className="mt-5 max-w-[58ch] text-[0.9375rem] leading-relaxed text-muted">
          Testnet only. Mint the test token, grant the pool operator rights, then deposit an encrypted amount. Your
          balance is readable by you alone, and your principal comes out whenever you ask for it.
        </p>

        {state && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">This draw</p>
              <a
                href={addressUrl(ADDRESSES.pool)}
                className="font-mono text-[0.6875rem] text-muted underline-offset-4 transition-colors hover:text-glow hover:underline"
              >
                Verify on Etherscan
              </a>
            </div>

            <Ladder
              total={state.totalTickets}
              winningNumber={state.winningNumber}
              drawn={drawn}
              epoch={state.drawnEpoch}
              compact
            />

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              <Stat
                label="weighted total"
                value={state.totalTickets > 0n ? state.totalTickets.toLocaleString("en-US") : "—"}
              />
              <Stat label="winning number" value={drawn ? state.winningNumber.toLocaleString("en-US") : "—"} />
              <Stat label="prize" value={`${formatUnits6(state.prizeAmount)} cUSDC`} tone="glow" />
              <Stat label="savers" value={state.participantCount.toString()} />
            </dl>
          </section>
        )}

        <WalletPanel />

        <p className="mt-16 hairline pt-6 text-xs leading-relaxed text-muted">
          Everything on the{" "}
          <Link href="/" className="text-clear underline-offset-4 hover:text-glow hover:underline">
            overview
          </Link>{" "}
          is readable without a wallet. Connecting one only ever reveals your own position, to you.
        </p>
      </main>
    </>
  );
}
