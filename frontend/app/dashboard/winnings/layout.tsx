import type { Metadata } from "next";

/**
 * Title and description for this tab.
 *
 * The page itself is a client component, which cannot export metadata, so it lives in a layout
 * that does nothing else. Without it every dashboard tab shared the site's default title, so a
 * browser tab or a shared link could not say which one you were on.
 */
export const metadata: Metadata = {
  title: "Winnings — Tenure",
  description: "Claim an epoch and move a prize into your balance.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
