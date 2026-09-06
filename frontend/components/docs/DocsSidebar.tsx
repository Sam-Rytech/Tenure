"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { DOCS } from "@/lib/docs";

/**
 * The documentation contents.
 *
 * On a wide screen it is a sticky rail marking the page you are on. Below that it becomes a native
 * `select` — a jump menu rather than a shrunken rail. That swap is deliberate: a horizontally
 * scrolling strip of ten links hides most of itself, while a `select` inherits the platform's own
 * picker, keyboard handling and assistive-technology behaviour instead of reimplementing them.
 *
 * Now that each topic is its own route, the active item comes from the path rather than from
 * watching headings scroll past. It is exact, it survives a page load, and it costs no observer.
 */
export function DocsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/*
        Phones and tablets: a jump menu kept under the nav. It carries its own background because
        the nav above is transparent until the page scrolls, and text sliding under transparent
        text is unreadable for the moment it takes to pass.
      */}
      <div className="sticky top-[4.25rem] z-30 -mx-5 border-b border-line bg-paper/95 px-5 pb-3 pt-2 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden">
        <label className="eyebrow" htmlFor="docs-jump">
          Documentation
        </label>
        <select
          id="docs-jump"
          value={pathname}
          onChange={(e) => router.push(e.target.value)}
          className="mt-1.5 w-full rounded-[2px] border border-line bg-raised px-3 py-2.5 text-[16px] text-clear"
        >
          {DOCS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.pages.map((page) => (
                <option key={page.href} value={page.href}>
                  {page.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Wide screens: a sticky rail. */}
      <nav aria-label="Documentation" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        {DOCS.map((group) => (
          <div key={group.label} className="mb-8">
            <p className="eyebrow">{group.label}</p>
            <ul className="mt-3">
              {group.pages.map((page) => {
                const on = pathname === page.href;
                return (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      aria-current={on ? "page" : undefined}
                      className={[
                        "-ml-px block border-l py-1.5 pl-3.5 text-[0.8125rem] transition-colors",
                        on ? "border-glow font-medium text-clear" : "border-line text-muted hover:text-clear",
                      ].join(" ")}
                    >
                      {page.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
