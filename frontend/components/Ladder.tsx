/**
 * The ticket ladder: Tenure's whole confidentiality claim in one object.
 *
 * The axis is public — it runs from 0 to the published weighted total, and the winning number sits
 * at a precise, checkable position on it. The contents are not. Every participant's range lives
 * inside this band as ciphertext, and no boundary is drawn, because no boundary is knowable. That
 * absence is the point: you can confirm exactly where the draw landed and still have no idea whose
 * range it landed in.
 */

/** Deterministic glyphs, so the band renders identically on server and client. */
function cipherGlyphs(seed: string, count: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out += alphabet[Math.abs(h) % 16];
  }
  return out;
}

interface LadderProps {
  total: bigint;
  winningNumber: bigint;
  drawn: boolean;
  epoch: number | null;
}

export function Ladder({ total, winningNumber, drawn, epoch }: LadderProps) {
  const hasAxis = total > 0n;
  const position = hasAxis ? Number((winningNumber * 10000n) / total) / 100 : 0;
  const clamped = Math.min(Math.max(position, 0), 100);
  const glyphs = cipherGlyphs(`${epoch ?? 0}:${total}:${winningNumber}`, 600);

  return (
    <figure className="mt-10">
      {/* The marker rail. Kept above the band so the public value never overlaps the private one. */}
      <div className="relative h-16">
        {drawn && hasAxis && (
          <div
            className="marker-drop absolute top-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${clamped}%` }}
          >
            <span className="font-mono text-[0.6875rem] tracking-widest uppercase text-slate">winning number</span>
            <span className="font-mono text-lg text-seal tabular-nums leading-tight">
              {winningNumber.toLocaleString("en-US")}
            </span>
            <span aria-hidden className="mt-1 block h-5 w-px bg-seal" />
            <span aria-hidden className="block h-2 w-2 rotate-45 -mt-1 bg-seal" />
          </div>
        )}
      </div>

      {/* The encrypted band. No divisions, because none are knowable. */}
      <div
        className="cipher-band relative overflow-hidden rounded-[2px] border-y border-ink-line bg-ink-raised"
        role="img"
        aria-label={
          drawn && hasAxis
            ? `Ticket ladder from 0 to ${total}. The winning number ${winningNumber} lands at ${clamped.toFixed(1)} percent along it. Every participant's range within the band is encrypted.`
            : "Ticket ladder. No draw has been published for this epoch yet."
        }
      >
        <p
          aria-hidden
          className="h-14 select-none break-all px-2 py-2.5 font-mono text-[0.7rem] leading-[1.15] tracking-[0.08em] text-cipher"
        >
          {glyphs}
        </p>
        {drawn && hasAxis && (
          <span aria-hidden className="absolute inset-y-0 w-px bg-seal" style={{ left: `${clamped}%` }} />
        )}
      </div>

      {/* The public axis. */}
      <div className="mt-2 flex items-baseline justify-between font-mono text-[0.6875rem] text-slate tabular-nums">
        <span>0</span>
        <span>{hasAxis ? total.toLocaleString("en-US") : "—"}</span>
      </div>

      <figcaption className="mt-4 max-w-prose text-sm leading-relaxed text-bone-dim">
        {drawn && hasAxis ? (
          <>
            The axis is public: {total.toLocaleString("en-US")} weighted tickets, and a winning number anyone can check.
            The band is every participant&rsquo;s ticket range, held as ciphertext. No divisions are drawn because none
            can be read — which is why the draw is verifiable and the winner is not identifiable.
          </>
        ) : (
          <>No draw has been published for this epoch yet. Once the ladder is built and the total is revealed, the
          winning number appears on this axis.</>
        )}
      </figcaption>
    </figure>
  );
}
