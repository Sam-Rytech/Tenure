"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Entrance motion that cannot hide content.
 *
 * Two rules, both of which exist because breaking either one paints the page blank:
 *
 * 1. Animate with `from`, never with a CSS `opacity: 0` default. The markup renders in its final,
 *    readable state and motion moves away from it, so the page survives a failed bundle and stays
 *    crawlable.
 *
 * 2. `immediateRender: false` on every tween. By default a `from` tween applies its start state
 *    the moment it is created, before it plays. GSAP's ticker rides on requestAnimationFrame,
 *    which browsers suspend in background tabs and throttle under load — so a tween created but
 *    never advanced leaves the content invisible permanently. Open the site in a background tab,
 *    switch to it, and the hero is gone. Deferring the start state means a tween that never runs
 *    simply does nothing, which is always the safe outcome.
 *
 * `gsap.matchMedia` supplies the reduced-motion branch: no tween is created at all, rather than
 * one that is played instantly.
 */

type RevealProps = {
  children: ReactNode;
  /** Animate the direct children in sequence rather than the block as a whole. */
  stagger?: boolean;
  delay?: number;
  as?: ElementType;
  className?: string;
  id?: string;
};

export function Reveal({ children, stagger = false, delay = 0, as: Tag = "div", className, id }: RevealProps) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const root = scope.current;
        if (!root) return;

        // Staggering past about eight items makes the last ones feel laggy.
        const targets = stagger ? Array.from(root.children).slice(0, 8) : root;

        gsap.from(targets, {
          opacity: 0,
          y: stagger ? 20 : 26,
          duration: 0.55,
          delay,
          ease: "power2.out",
          stagger: stagger ? 0.075 : 0,
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        });
      });

      return () => media.revert();
    },
    { scope },
  );

  return (
    <Tag ref={scope} className={className} id={id}>
      {children}
    </Tag>
  );
}

/**
 * The hero's opening sequence.
 *
 * One orchestrated moment rather than scattered effects: the eyebrow, the two headline lines, the
 * supporting copy and the actions arrive in reading order, and the winning-number marker drops in
 * last, after the axis it refers to exists.
 */
export function HeroChoreography({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({
          defaults: { ease: "power3.out", immediateRender: false },
        });

        timeline
          .from("[data-hero-eyebrow]", { opacity: 0, y: 12, duration: 0.5 })
          .from("[data-hero-line]", { opacity: 0, y: 28, duration: 0.7, stagger: 0.1 }, "-=0.25")
          .from("[data-hero-copy]", { opacity: 0, y: 18, duration: 0.6 }, "-=0.4")
          .from("[data-hero-actions] > *", { opacity: 0, y: 14, duration: 0.5, stagger: 0.08 }, "-=0.35")
          .from("[data-hero-proof] > *", { opacity: 0, duration: 0.5, stagger: 0.06 }, "-=0.3")
          .from("[data-hero-panel]", { opacity: 0, y: 30, duration: 0.8 }, "-=0.5");

        // The marker only exists once a draw has been published.
        if (document.querySelector("[data-reveal-marker]")) {
          timeline.from("[data-reveal-marker]", { opacity: 0, y: -14, duration: 0.6, ease: "back.out(1.6)" }, "-=0.25");
        }

        // Fonts and the live panel change layout height; recalculate once settled.
        void document.fonts?.ready.then(() => ScrollTrigger.refresh());
      });

      return () => media.revert();
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
