import type { Metadata } from "next";

import { PageHead, H2, P, Callout } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "The ticket ladder — Tenure",
  description: "How Tenure assigns odds over encrypted balances without revealing any of them.",
};

export default function Ladder() {
  return (
    <>
      <PageHead
        section="The ticket ladder"
        title="The ticket ladder."
        lede="Odds have to come from balances, and the balances are secret. The ladder is how a winner is selected over numbers nobody can read."
      />

      <H2>Ranges laid end to end</H2>
      <P>
        Each saver holds a half-open ticket range whose width is their weighted balance. The ranges are laid end to end,
        so they are disjoint and together cover everything from zero to the total. Draw a number below the total and it
        falls inside exactly one range — which is the whole selection mechanism, and the reason at most one person can
        ever be in range.
      </P>
      <P>
        Nothing about a range is published. Its width is your encrypted balance and its position is the sum of everyone
        before you, so both endpoints stay ciphertext. Only the final total and the drawn number are ever made public.
      </P>

      <H2>Why it is built in chunks</H2>
      <P>
        Building the ladder is a running sum, and a running sum is inherently sequential: each range starts where the
        previous one ended. Under homomorphic encryption that chain is the binding cost, because the protocol limits the
        longest sequence of dependent operations in a single transaction more tightly than it limits their total.
      </P>
      <P>
        So the ladder is built twenty savers at a time, across as many transactions as it takes. The pool is therefore
        not capped by what fits in one block, and the chunk size is a measured choice rather than a guess.
      </P>

      <H2>Empty rungs</H2>
      <P>
        A saver who is ineligible or holds nothing is given an empty range rather than being skipped. An empty range
        cannot be drawn, and keeping it preserves the index of everyone after it. The alternative is a compacting list,
        whose indices shift under you between chunks — and a shifted index means a saver silently dropped from a draw.
      </P>

      <Callout label="Tested at the boundary">
        The chunk arithmetic is covered at nineteen, twenty and twenty-one participants: one under a full chunk, exactly
        on it, and one over. An off-by-one there would not throw an error. It would quietly leave somebody out of the
        draw, which is the kind of bug that only shows up in the one run you cannot repeat.
      </Callout>
    </>
  );
}
