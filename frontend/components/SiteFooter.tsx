import Link from "next/link";

import { ADDRESSES, addressUrl } from "@/lib/config";

/**
 * The site footer.
 *
 * Three columns of links that all resolve to something real: the protocol sections on the
 * overview, the documentation, and the outside resources someone would actually need to try this
 * — a faucet, the explorer, Zama's own docs.
 */
const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Protocol",
    links: [
      { label: "How a draw works", href: "/#how" },
      { label: "What stays private", href: "/#privacy" },
      { label: "Tenure weighting", href: "/#tenure" },
      { label: "The live pool", href: "/#pool" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Deployed contracts", href: "/docs/deployments" },
      { label: "Questions", href: "/#faq" },
      { label: "Open the pool", href: "/dashboard" },
    ],
  },
  {
    title: "Elsewhere",
    links: [
      { label: "GitHub", href: "https://github.com/Sam-Rytech/Tenure", external: true },
      { label: "Zama Protocol docs", href: "https://docs.zama.ai/protocol", external: true },
      { label: "Get Sepolia ETH", href: "https://sepoliafaucet.com/", external: true },
      { label: "Sepolia explorer", href: addressUrl(ADDRESSES.pool), external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="hairline mt-24 pt-10">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="block h-2 w-2 rounded-full bg-glow" />
            <span className="display text-[1rem] tracking-tight text-clear">Tenure</span>
          </div>
          <p className="mt-4 max-w-[38ch] text-[0.8125rem] leading-relaxed text-muted">
            A confidential prize savings pool. Your money stays yours. Only the yield is played for.
          </p>
          <p className="mt-4 max-w-[38ch] text-xs leading-relaxed text-muted-dim">
            Testnet only, on Sepolia, with test tokens. Not audited by anyone else, and not a place for real savings.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="eyebrow">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[0.8125rem] text-muted transition-colors hover:text-clear"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-[0.8125rem] text-muted transition-colors hover:text-clear">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-12 border-t border-line pt-6 text-xs text-muted-dim">
        Built on the Zama Protocol for the Zama Developer Program. Ethereum Sepolia.
      </p>
    </footer>
  );
}
