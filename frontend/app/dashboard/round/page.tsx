"use client";

import { useReadContract } from "wagmi";

import { Ladder } from "@/components/Ladder";
import { PageHead } from "@/components/dashboard/ui";
import { TENURE_POOL_ABI } from "@/lib/abi";
import { ADDRESSES, PHASE_LABELS, addressUrl, formatUnits6 } from "@/lib/config";

const pool = { address: ADDRESSES.pool, abi: TENURE_POOL_ABI } as const;

/**
 * The current draw.
 *
 * Everything on this page is public, so it reads the chain directly and works with or without a
 * wallet — the same promise the overview page makes. It is the one dashboard tab that is not
 * behind the connect gate.
 */
export default function Round() {
  const { data: epoch } = useReadContract({ ...pool, functionName: "currentEpoch" });
  const { data: phase } = useReadContract({ ...pool, functionName: "phase" });
  const { data: participants } = useReadContract({ ...pool, functionName: "participantCount" });

  const epochNumber = epoch === undefined ? undefined : Number(epoch);
  // A tuple, not an array: these reads take exactly one argument and wagmi types them that way.
  const args = epochNumber === undefined ? undefined : ([epochNumber] as const);
  const query = { enabled: epochNumber !== undefined } as const;

  const { data: total } = useReadContract({ ...pool, functionName: "epochTotalTickets", args, query });
  const { data: winning } = useReadContract({ ...pool, functionName: "epochWinningNumber", args, query });
  const { data: prize } = useReadContract({ ...pool, functionName: "prizeAmount", args, query });

  const totalTickets = (total as bigint | undefined) ?? 0n;
  const winningNumber = (winning as bigint | undefined) ?? 0n;
  const drawn = totalTickets > 0n && winningNumber > 0n;

  return (
    <>
      <PageHead
        title="This draw"
        lede="All of this is public, and none of it names anyone. The total and the winning number are what let a stranger check the draw was honest. The ranges they were drawn against stay encrypted."
      />

      <div className="flex items-baseline justify-between">
        <p className="eyebrow">
          {epochNumber !== undefined ? `Epoch ${epochNumber}` : "Loading"}
          {phase !== undefined ? ` · ${PHASE_LABELS[Number(phase)] ?? "unknown"}` : ""}
        </p>
        <a
          href={addressUrl(ADDRESSES.pool)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-[0.6875rem] text-muted underline-offset-4 hover:text-glow hover:underline"
        >
          Check on Etherscan
        </a>
      </div>

      <Ladder total={totalTickets} winningNumber={winningNumber} drawn={drawn} epoch={epochNumber ?? null} compact />

      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <Stat label="weighted total" value={totalTickets > 0n ? totalTickets.toLocaleString("en-US") : "—"} />
        <Stat label="winning number" value={drawn ? winningNumber.toLocaleString("en-US") : "—"} />
        <Stat label="prize" value={`${formatUnits6(prize as bigint | undefined)} cUSDC`} glow />
        <Stat label="savers" value={participants === undefined ? "—" : String(participants)} />
      </dl>

      <p className="mt-10 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
        The weighted total is bigger than the sum of the deposits whenever people have held across a draw. That gap is
        the tenure multiplier, and it is the one number here that shows it.
      </p>
    </>
  );
}

function Stat({ label, value, glow = false }: { label: string; value: string; glow?: boolean }) {
  return (
    <div className="hairline pt-3">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1.5 font-mono text-[0.875rem] tabular-nums ${glow ? "text-glow" : "text-clear"}`}>{value}</dd>
    </div>
  );
}
