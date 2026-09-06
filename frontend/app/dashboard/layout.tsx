import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export const metadata: Metadata = {
  title: "Your position — Tenure",
  description: "Your encrypted balance, pending prize and tenure multiplier.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav cta={{ href: "/", label: "Back to overview" }} />

      <main className="mx-auto w-full max-w-4xl px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
        <p className="eyebrow">The pool</p>
        <p className="mt-3 max-w-[58ch] text-[0.875rem] leading-relaxed text-muted">
          Testnet only. Get the test token, let the pool move it, then deposit an encrypted amount. Your balance is
          readable by you and nobody else, and you can take it out whenever you want.
        </p>

        <div className="mt-8">
          <DashboardTabs />
        </div>

        <div className="mt-10">{children}</div>

        <SiteFooter />
      </main>
    </>
  );
}
