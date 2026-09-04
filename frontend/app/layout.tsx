import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Display: optically sized, characterful without reaching for a serif cliché. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

/** Body: drawn for technical documentation, which is the register this product wants. */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Data: ciphertext, handles, hashes, figures. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tenure — hold longer, win quieter",
  description:
    "A confidential prize savings pool on the Zama Protocol. Balances stay encrypted, odds rise the longer you hold, and anyone can verify the draw without learning who won.",
  openGraph: {
    title: "Tenure — hold longer, win quieter",
    description:
      "Confidential prize savings. Encrypted balances, tenure-weighted odds, a publicly verifiable draw and an unidentifiable winner.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
