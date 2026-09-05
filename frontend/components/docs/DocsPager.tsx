"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { docsNeighbours } from "@/lib/docs";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

/**
 * Previous and next, at the foot of every documentation page.
 *
 * It lives in the layout rather than in each page so the order cannot drift out of step with the
 * sidebar — both read the same list. The last page has no next, so it hands the reader to the app
 * instead of to a dead end.
 */
export function DocsPager() {
  const pathname = usePathname();
  const { prev, next } = docsNeighbours(pathname);

  return (
    <nav aria-label="Documentation pages" className="hairline mt-16 pt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {prev ? (
          <Link
            href={prev.href}
            rel="prev"
            className="group panel p-5 transition-colors hover:border-line-bright sm:p-6"
          >
            <p className="eyebrow flex items-center gap-1.5">
              <ArrowLeft aria-hidden className="h-3 w-3" />
              Previous
            </p>
            <p className="mt-2.5 text-[1rem] text-clear transition-colors group-hover:text-glow">{prev.label}</p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{prev.blurb}</p>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            href={next.href}
            rel="next"
            className="group panel p-5 transition-colors hover:border-line-bright sm:col-start-2 sm:p-6 sm:text-right"
          >
            <p className="eyebrow flex items-center gap-1.5 sm:justify-end">
              Next
              <ArrowRight aria-hidden className="h-3 w-3" />
            </p>
            <p className="mt-2.5 text-[1rem] text-clear transition-colors group-hover:text-glow">{next.label}</p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{next.blurb}</p>
          </Link>
        ) : (
          <div className="panel p-5 sm:col-start-2 sm:p-6 sm:text-right">
            <p className="eyebrow">That is all of it</p>
            <p className="mt-2.5 max-w-[42ch] text-[0.8125rem] leading-relaxed text-muted sm:ml-auto">
              Ten pages, four contracts and a keeper. The tests are the honest part: they cover the failure paths, not
              just the happy one.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 sm:justify-end">
              <InteractiveHoverButton href="/dashboard" text="Enter the pool" />
              <a
                href="https://github.com/Sam-Rytech/Tenure"
                className="btn btn-ghost"
                target="_blank"
                rel="noreferrer noopener"
              >
                Read the code
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
