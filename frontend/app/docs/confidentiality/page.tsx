import type { Metadata } from "next";

import { PageHead, H2, P, Callout } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "Public and encrypted — Tenure",
  description: "The exact confidentiality boundary, including what still leaks.",
};

export default function Confidentiality() {
  return (
    <>
      <PageHead
        section="Public and encrypted"
        title="The boundary, stated plainly."
        lede="Confidentiality claims are easy to make and hard to keep once money moves. This is the line as deployed, including the parts that are less flattering."
      />

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Public — anyone can check</p>
          <ul className="mt-4 space-y-3 text-[0.875rem] text-clear">
            <li className="hairline pt-3">The weighted ticket total for each epoch</li>
            <li className="hairline pt-3">The winning ticket number</li>
            <li className="hairline pt-3">The prize amount and the epoch schedule</li>
            <li className="hairline pt-3">That an address took part at all</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow !text-glow">Encrypted — only you can read</p>
          <ul className="mt-4 space-y-3 text-[0.875rem] text-clear">
            <li className="hairline pt-3">Every balance, at every point in time</li>
            <li className="hairline pt-3">Every individual ticket range</li>
            <li className="hairline pt-3">Every credited prize, won or not</li>
            <li className="hairline pt-3">Which address won</li>
          </ul>
        </div>
      </div>

      <H2>Why the total is public on purpose</H2>
      <P>
        It would be possible to keep the total secret too. It would also make the draw unverifiable: without the total,
        nobody can check that the winning number was reduced against the right range, and the protocol would be asking
        for trust exactly where it should be offering proof. The total and the drawn number are published together
        because that pair is what an auditor needs, and on its own it names nobody.
      </P>

      <Callout label="What still leaks">
        Participation is visible even though amounts are not — Tenure hides balances and outcomes, not the act of taking
        part. The published total loosely bounds how much is in the pool. With very few savers, an observer who already
        knows some balances can narrow the field, which is true of any pool. And because awards are encrypted, the
        contract cannot tell a winning claim from a losing one, which is why an unclaimed prize only rolls forward when
        nobody claimed at all.
      </Callout>
    </>
  );
}
