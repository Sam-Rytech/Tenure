import { addressUrl } from "@/lib/config";

/**
 * The pieces every documentation page is built from.
 *
 * Deliberately few. A documentation system that offers a dozen block types produces pages that
 * each look slightly different; four that are used consistently produce pages that read as one
 * document.
 */

/** The page's own heading, with the breadcrumb above it. */
export function PageHead({ title, lede, section }: { title: string; lede: string; section: string }) {
  return (
    <header>
      <p>
        <span className="eyebrow">Docs</span>
        <span aria-hidden className="mx-2.5 text-line-bright">
          ·
        </span>
        <span className="eyebrow">{section}</span>
      </p>
      <h1 className="display mt-5 text-[clamp(1.875rem,4.6vw,2.75rem)]">{title}</h1>
      <p className="mt-5 max-w-[62ch] text-[1rem] leading-relaxed text-muted">{lede}</p>
    </header>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-14 text-[1.375rem] text-clear sm:text-[1.5rem]">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[68ch] text-[0.875rem] leading-relaxed text-muted">{children}</p>;
}

export function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel mt-8 p-5 sm:p-6">
      <p className="eyebrow !text-glow">{label}</p>
      <p className="mt-2.5 max-w-[64ch] text-[0.875rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/** A term and what it means. The term is the label, so it holds the mono column. */
export function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-4 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-8">
      <code className="font-mono text-[0.8125rem] text-clear">{term}</code>
      <p className="text-[0.875rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/** A numbered step. Numbering is used only where order genuinely carries meaning. */
export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-1.5 border-t border-line pt-4 sm:grid-cols-[2.5rem_1fr]">
      <span className="section-index">{String(n).padStart(2, "0")}</span>
      <div>
        <p className="text-[0.875rem] text-clear">{title}</p>
        <p className="mt-1.5 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}

export function Figure({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="font-mono text-[1.375rem] tabular-nums text-clear">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

export function AddressRow({ label, address, note }: { label: string; address: string; note: string }) {
  return (
    <div className="grid gap-2 border-t border-line py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8">
      <p className="text-[0.875rem] text-clear">{label}</p>
      <div className="min-w-0">
        <a
          href={addressUrl(address)}
          className="block break-all font-mono text-[0.8125rem] text-glow underline-offset-4 hover:underline"
        >
          {address}
        </a>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{note}</p>
      </div>
    </div>
  );
}
