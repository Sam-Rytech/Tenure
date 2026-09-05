"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The dashboard's tabs.
 *
 * Five, matching what the pool actually does. There is one pool rather than a choice of vaults,
 * and no separate identity or card product, so there are no tabs standing in for features that
 * do not exist.
 *
 * The strip scrolls sideways on a narrow screen rather than wrapping onto a second line, which
 * would push the page content below the fold on a phone.
 */
const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/deposit", label: "Deposit" },
  { href: "/dashboard/round", label: "Round" },
  { href: "/dashboard/winnings", label: "Winnings" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map((tab) => {
          const on = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={[
                  "-mb-px block whitespace-nowrap border-b-2 px-3 py-3 text-[0.8125rem] transition-colors",
                  on ? "border-glow font-medium text-clear" : "border-transparent text-muted hover:text-clear",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
