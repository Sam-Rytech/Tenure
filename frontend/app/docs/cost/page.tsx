import type { Metadata } from "next";

import { PageHead, H2, P, Figure } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "Homomorphic cost — Tenure",
  description: "The two per-transaction ceilings on encrypted arithmetic, and how they set Tenure's chunk size.",
};

export default function Cost() {
  return (
    <>
      <PageHead
        section="Homomorphic cost"
        title="What the ceilings are."
        lede="Encrypted arithmetic is metered in homomorphic complexity units, with two limits per transaction: a total, and a separate limit on the longest sequential chain."
      />

      <H2>Why depth is the binding one</H2>
      <P>
        The running sum in the ladder is a sequential chain by nature — each range starts where the last one ended — so
        it is measured against the depth ceiling rather than the total. That is what sets the chunk size. The bit-shift
        that applies a tenure tier branches off the chain instead of extending it, which is why the multiplier is nearly
        free.
      </P>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <Figure value="20" label="savers per chunk" note="The ladder extends twenty at a time." />
        <Figure value="3.24M" label="depth per chunk" note="Against a 5M ceiling — 35% headroom at the chosen size." />
        <Figure value="1.18M" label="the draw itself" note="Generating randomness and reducing it against the total." />
      </div>

      <H2>Measured, not estimated</H2>
      <P>
        These come from the published costs of the operations involved. One correction is worth recording, because it
        was nearly missed: the reduction that produces the winning number costs about 1.6 times what an earlier reading
        of the table suggested, having been confused with a neighbouring operation. It still fits comfortably, but it
        fits on purpose rather than by luck.
      </P>
      <P>
        There is one optimisation deliberately not taken. A newer built-in can sum a list of ciphertexts in one call,
        which sounds like exactly what the ladder needs. It is not: it produces a single total, and the ladder needs
        every running subtotal along the way. It could replace the last value, which is already free. So it is left out
        for a structural reason rather than an unmeasured one.
      </P>
    </>
  );
}
