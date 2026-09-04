import type { Metadata } from "next";
import { Fraunces, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Display: archival authority, with optical sizing so large settings keep their character. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

/** Body: drawn for public records, which is exactly this page's job. */
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

/** Data: handles, hashes and ciphertext. */
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tenure — confidential prize savings",
  description:
    "A no-loss prize pool where balances stay encrypted and odds rise the longer you hold. Anyone can verify a draw; nobody can identify the winner.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
