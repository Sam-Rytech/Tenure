/**
 * The ticket ladder, set like a printed record.
 *
 * The axis is public: it runs from zero to the published weighted total, and the winning number
 * sits at a precise, checkable position on it. Everything inside the band is not. Each
 * participant's ticket range lives there as ciphertext, rendered as gold leaf on cream with no
 * divisions drawn, because no division is knowable.
 *
 * The palette carries the argument. The band is gold, which in this interface always means
 * encrypted and yours. The marker is black, which always means published and checkable by anyone.
 * You can see exactly where the draw landed and still have no idea whose range it landed in.
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
  /** Compact form drops the caption, for use inside the app shell. */
  compact?: boolean;
}

export function Ladder({ total, winningNumber, drawn, epoch, compact = false }: LadderProps) {
  const hasAxis = total > 0n;
  const position = hasAxis ? Number((winningNumber * 10000n) / total) / 100 : 0;
  const clamped = Math.min(Math.max(position, 0), 100);
  const glyphs = cipherGlyphs(`${epoch ?? 0}:${total}:${winningNumber}`, 900);

  return (
    <figure className="mt-8">
      {/* The marker rail sits above the band so the published value never overlaps the private one. */}
      <div className="relative h-20 sm:h-[5.5rem]">
        {drawn && hasAxis && (
          <div
            data-reveal-marker
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${clamped}%` }}
          >
            <span className="eyebrow whitespace-nowrap !text-[0.625rem]">winning number</span>
            <span className="mt-1 font-mono text-xl leading-none tabular-nums text-clear sm:text-[1.375rem]">
              {winningNumber.toLocaleString("en-US")}
            </span>
            <span aria-hidden className="mt-2 block h-6 w-px bg-clear" />
          </div>
        )}
      </div>

      {/* The exposure. Light accumulated along the axis, unreadable and undivided. */}
      <div
        className="relative overflow-hidden rounded-[2px] border-y border-line bg-raised"
        role="img"
        aria-label={
          drawn && hasAxis
            ? `Ticket ladder from 0 to ${total}. The winning number ${winningNumber} falls at ${clamped.toFixed(1)} percent along the axis. Every participant's range inside the band is encrypted, and no divisions are shown because none can be read.`
            : "Ticket ladder. No draw has been published for this epoch yet."
        }
      >
        <div aria-hidden className="trail absolute inset-0" />

        <p
          aria-hidden
          className="relative h-16 select-none break-all px-2 py-2.5 font-mono text-[0.7rem] leading-[1.2] tracking-[0.1em] text-glow/45 blur-[1.05px] sm:h-20 sm:text-[0.78rem]"
        >
          {glyphs}
        </p>

        {/* The one point in focus. */}
        {drawn && hasAxis && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-clear shadow-[0_0_10px_rgba(16,14,11,0.28)]"
            style={{ left: `${clamped}%` }}
          />
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between font-mono text-[0.6875rem] tabular-nums text-muted">
        <span>0</span>
        <span className="text-clear">{hasAxis ? total.toLocaleString("en-US") : "—"}</span>
      </div>

      {!compact && (
        <figcaption className="mt-5 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
          {drawn && hasAxis ? (
            <>
              The axis is public — {total.toLocaleString("en-US")} weighted tickets and a winning number anyone can
              check. The band is every participant&rsquo;s ticket range, held as ciphertext. No divisions are drawn
              because none can be read, and that absence is the point: the draw is verifiable and the winner is not
              identifiable.
            </>
          ) : (
            <>
              No draw has been published for this epoch yet. Once the ladder is built and the total is revealed, the
              winning number appears on this axis.
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}
