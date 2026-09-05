"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

/**
 * Floating navigation.
 *
 * It condenses once the hero is behind you, which is the one piece of state the nav needs to
 * carry: whether you are still being pitched to, or already reading.
 */
export function Nav({ cta = { href: "/dashboard", label: "Enter the pool" } }: { cta?: { href: string; label: string } }) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5">
      <nav
        aria-label="Primary"
        className={[
          "mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-[999px] border px-4 py-2.5 sm:px-5",
          "transition-[background-color,border-color,backdrop-filter] duration-300",
          condensed ? "border-line bg-[rgba(252,251,248,0.78)] backdrop-blur-xl" : "border-transparent bg-transparent",
        ].join(" ")}
      >
        <Link href="/" className="flex items-center gap-2.5 rounded-[2px]">
          <span aria-hidden className="block h-2 w-2 rounded-full bg-glow" />
          <span className="display text-[1rem] tracking-tight text-clear">Tenure</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/#how"
            className="hidden rounded-[2px] px-3 py-2 text-[0.8125rem] text-muted transition-colors hover:text-clear sm:block"
          >
            How it works
          </Link>
          <Link
            href="/#privacy"
            className="hidden rounded-[2px] px-3 py-2 text-[0.8125rem] text-muted transition-colors hover:text-clear sm:block"
          >
            What stays private
          </Link>
          <Link
            href="/docs"
            className="rounded-[2px] px-3 py-2 text-[0.8125rem] text-muted transition-colors hover:text-clear"
          >
            Docs
          </Link>
          <InteractiveHoverButton href={cta.href} text={cta.label} className="px-5 text-[0.8125rem]" />
        </div>
      </nav>
    </header>
  );
}
