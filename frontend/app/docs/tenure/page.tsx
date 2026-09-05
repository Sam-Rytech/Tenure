import type { Metadata } from "next";

import { PageHead, H2, P, Row } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "Tenure weighting — Tenure",
  description: "Why holding longer raises your odds, and why the multiplier is a deployment parameter.",
};

export default function TenurePage() {
  return (
    <>
      <PageHead
        section="Tenure weighting"
        title="Odds that come into focus."
        lede="Encryption removes what a sniper reads. Tenure removes what they read it for."
      />

      <H2>The tiers</H2>
      <P>
        Hold across an epoch boundary and your ticket range doubles; hold four and it is eight times what it started at.
        The multiplier is a bit-shift on the encrypted balance, so it costs almost nothing and never leaves ciphertext.
      </P>
      <div className="mt-6">
        <Row term="tier 0 — 1x">New this epoch.</Row>
        <Row term="tier 1 — 2x">Held across one epoch boundary.</Row>
        <Row term="tier 2 — 4x">Held across two or three.</Row>
        <Row term="tier 3 — 8x">Held across four or more.</Row>
      </div>

      <H2>The reset rule</H2>
      <P>
        Any deposit or withdrawal returns you to tier zero. There is no way to park dust for months and then arrive
        large the block before a draw, which is the exact strategy that transparent prize pools have to survive. The
        cost of that rule is real and worth stating: topping up a position resets its tenure, so adding to a long-held
        balance is a decision rather than a free action.
      </P>

      <H2>A parameter, not a rule</H2>
      <P>
        The tiers are set at deployment rather than welded into the contract. Set them all equal and Tenure reduces
        exactly to strict deposit-weighting — canonical PoolTogether, with encryption and nothing else. That equivalence
        is asserted by a test rather than claimed here, which is the only version of such a claim worth making.
      </P>
    </>
  );
}
