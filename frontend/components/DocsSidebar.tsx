"use client";

import { useEffect, useState } from "react";

/**
 * The docs table of contents.
 *
 * On a wide screen it is a sticky rail that tracks reading position. On a phone there is no room
 * for a rail, so the same list becomes a native `select` — a jump menu rather than a shrunken
 * sidebar. That is a deliberate swap: a horizontally scrolling strip of a dozen links hides most
 * of its own contents, and a `select` gets the platform's own picker, keyboard handling and
 * assistive-technology behaviour for free.
 */

export interface DocsGroup {
  label: string;
  items: { id: string; label: string }[];
}

export function DocsSidebar({ groups }: { groups: DocsGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    /*
     * Track the heading nearest the top of the viewport rather than whichever section happens to
     * be most visible. With sections of very different heights, "most visible" makes a long
     * section hold the highlight while the reader is already well into the next one.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/*
        Phones and tablets: a jump menu, kept sticky under the nav. Docs are long and the contents
        is the one control a reader wants at any depth; scrolled away at the top of the page it
        would only be usable from the top of the page. It carries its own background because the
        nav above it is transparent until the page scrolls, and text sliding under transparent
        text is unreadable for the moment it takes to pass.
      */}
      <div className="sticky top-[4.25rem] z-30 -mx-5 border-b border-line bg-paper/95 px-5 pb-3 pt-2 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden">
        <label className="eyebrow" htmlFor="docs-jump">
          Jump to
        </label>
        <select
          id="docs-jump"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            document.getElementById(e.target.value)?.scrollIntoView({ block: "start" });
          }}
          className="mt-1.5 w-full rounded-[2px] border border-line bg-raised px-3 py-2.5 text-base text-clear"
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Wide screens: a sticky rail. */}
      <nav aria-label="Documentation" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        {groups.map((group) => (
          <div key={group.label} className="mb-8">
            <p className="eyebrow">{group.label}</p>
            <ul className="mt-3">
              {group.items.map((item) => {
                const on = active === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={on ? "location" : undefined}
                      className={[
                        "-ml-px block border-l py-1.5 pl-3.5 text-[0.8125rem] transition-colors",
                        on ? "border-glow font-medium text-clear" : "border-line text-muted hover:text-clear",
                      ].join(" ")}
                    >
                      {item.label}
                    </a>
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
