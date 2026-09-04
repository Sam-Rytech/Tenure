"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A button whose label slides out as a copy slides in behind it, while a dot expands from the
 * left to flood the surface.
 *
 * Adapted from the shadcn "interactive hover button" pattern. Two changes were necessary here.
 *
 * The original is written against shadcn's semantic tokens — `bg-background`, `bg-primary`,
 * `text-primary-foreground` — none of which exist in this project, so the colours are expressed
 * in Tenure's own tokens and the flood follows the palette's rule: the primary button rests gold
 * and floods to black, the secondary rests bare and floods to gold. Both directions land on a
 * pair that was measured, not guessed.
 *
 * The original also hardcodes `w-32`, which truncates any label longer than a word or two. Width
 * here comes from the content, and the incoming label is positioned against the full box rather
 * than a fixed offset, so "How a draw works" and "Enter the pool" both work.
 */

type Variant = "primary" | "ghost";

interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  variant?: Variant;
  /** Render as a link. Navigation should be an anchor, not a button with an onClick. */
  href?: string;
}

const surface: Record<Variant, string> = {
  primary: "border-glow-bright bg-glow-bright text-clear",
  ghost: "border-line-bright bg-transparent text-clear",
};

/** The dot that floods the surface, and therefore the hovered background colour. */
const flood: Record<Variant, string> = {
  primary: "bg-clear",
  ghost: "bg-glow-bright",
};

/** Label colour once the flood has landed. */
const floodedLabel: Record<Variant, string> = {
  primary: "text-paper",
  ghost: "text-clear",
};

const InteractiveHoverButton = React.forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  ({ text, variant = "primary", href, className, ...props }, ref) => {
    const content = (
      <>
        {/* Resting label. Leaves to the right as the replacement arrives. */}
        <span className="relative z-20 inline-block whitespace-nowrap transition-all duration-300 ease-out group-hover:translate-x-3 group-hover:opacity-0 motion-reduce:transition-none">
          {text}
        </span>

        {/* Incoming label, with the affordance the original adds on arrival. */}
        <span
          className={cn(
            "absolute inset-0 z-20 flex translate-x-3 items-center justify-center gap-2 whitespace-nowrap opacity-0",
            "transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none",
            floodedLabel[variant],
          )}
        >
          {text}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </span>

        {/*
          The flood. Purely decorative, so it is hidden from assistive technology.

          The original animates left/top/width/height from a 2px dot. Two problems: those are
          layout properties rather than compositor ones, and at a fixed `w-32` the resting dot sits
          politely behind the label, whereas at content width it lands on the first letter and
          reads as a blemish. This is a circle that is simply not there at rest and scales up from
          a point on hover — transform and opacity only, so it stays on the compositor.
        */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 scale-0 rounded-full",
            "transition-transform duration-[400ms] ease-out group-hover:scale-[5]",
            "motion-reduce:transition-none",
            flood[variant],
          )}
        />
      </>
    );

    const classes = cn(
      "group relative inline-flex min-h-[44px] cursor-pointer items-center justify-center overflow-hidden",
      "rounded-full border px-6 text-[0.9375rem] font-medium leading-none",
      "transition-colors duration-200",
      surface[variant],
      className,
    );

    if (href) {
      return (
        <Link href={href} className={classes}>
          {content}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {content}
      </button>
    );
  },
);

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
