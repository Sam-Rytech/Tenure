"use client";

import { describeError } from "@/lib/errors";
import { txUrl, shorten } from "@/lib/config";

/** The pieces the dashboard pages share. Few on purpose, so the tabs read as one screen. */

export function Button({
  children,
  onClick,
  disabled,
  busy,
  busyLabel,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Shown instead of "Working…" so a three-step action says which step it is on. */
  busyLabel?: string | null;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`btn ${primary ? "btn-primary" : "btn-ghost"} text-[0.8125rem]`}
    >
      {busy ? (busyLabel ?? "Working\u2026") : children}
    </button>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
      <span className="eyebrow">{label}</span>
      <span className="font-mono text-[0.8125rem] tabular-nums text-clear">{children}</span>
    </div>
  );
}

export function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="mb-8">
      <h1 className="display text-[1.5rem] text-clear sm:text-[1.75rem]">{title}</h1>
      <p className="mt-3 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">{lede}</p>
    </header>
  );
}

/** Says what went wrong in the interface's own voice rather than raw revert text. */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const friendly = describeError(error);
  return (
    <div className="mt-5 rounded-[2px] border border-glow-dim bg-raised p-4">
      <p className="text-[0.8125rem] text-glow">{friendly.title}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{friendly.action}</p>
    </div>
  );
}

export function LastTx({ hash }: { hash: `0x${string}` | null }) {
  if (!hash) return null;
  return (
    <p className="mt-5 font-mono text-xs text-muted">
      last transaction{" "}
      <a className="underline underline-offset-2 hover:text-glow" href={txUrl(hash)} target="_blank" rel="noreferrer">
        {shorten(hash, 10, 8)}
      </a>
    </p>
  );
}
