/**
 * The documentation map.
 *
 * One list, used three ways: the sidebar renders it grouped, the jump menu renders it as options,
 * and the footer walks it in order for previous and next. Keeping order and grouping in a single
 * place is what stops the three from disagreeing after a page is added or moved.
 */

export interface DocsPage {
  href: string;
  /** Sidebar and jump-menu label. Short, because the rail is narrow. */
  label: string;
  /** Shown under the previous/next arrows, where there is room for a fuller sentence. */
  blurb: string;
}

export interface DocsGroup {
  label: string;
  pages: DocsPage[];
}

export const DOCS: DocsGroup[] = [
  {
    label: "Start here",
    pages: [
      { href: "/docs", label: "Overview", blurb: "What Tenure is, and what it deliberately makes public." },
      {
        href: "/docs/draw",
        label: "A draw in five phases",
        blurb: "Every call in the draw machine, and who may make it.",
      },
      {
        href: "/docs/quickstart",
        label: "Try it on Sepolia",
        blurb: "From an empty wallet to a position in the pool.",
      },
    ],
  },
  {
    label: "Protocol",
    pages: [
      { href: "/docs/ladder", label: "The ticket ladder", blurb: "How odds are assigned without revealing a balance." },
      {
        href: "/docs/tenure",
        label: "Tenure weighting",
        blurb: "Why holding longer pays, and why sniping stops working.",
      },
      {
        href: "/docs/confidentiality",
        label: "Public and encrypted",
        blurb: "The exact boundary, including what still leaks.",
      },
      {
        href: "/docs/decryption",
        label: "Decryption without an oracle",
        blurb: "How two values cross into plaintext, and who is trusted.",
      },
      {
        href: "/docs/recovery",
        label: "When something stalls",
        blurb: "Every failure path, and the escape from each one.",
      },
    ],
  },
  {
    label: "Reference",
    pages: [
      { href: "/docs/cost", label: "Homomorphic cost", blurb: "The ceilings that set the chunk size." },
      {
        href: "/docs/deployments",
        label: "Deployed contracts",
        blurb: "Verified Sepolia addresses and what each one holds.",
      },
    ],
  },
];

/** Reading order, flattened. The footer arrows walk this. */
export const DOCS_ORDER: DocsPage[] = DOCS.flatMap((g) => g.pages);

export function docsNeighbours(pathname: string): { prev?: DocsPage; next?: DocsPage } {
  const i = DOCS_ORDER.findIndex((p) => p.href === pathname);
  if (i < 0) return {};
  return { prev: DOCS_ORDER[i - 1], next: DOCS_ORDER[i + 1] };
}
