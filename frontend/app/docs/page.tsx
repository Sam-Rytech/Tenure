import type { Metadata } from "next";
import Link from "next/link";

import { PageHead, H2, P, Callout } from "@/components/docs/DocsUI";
import { DOCS } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation — Tenure",
  description:
    "A confidential no-loss prize savings pool on the Zama Protocol: encrypted balances, tenure-weighted odds, a publicly verifiable draw and an unidentifiable winner.",
};

export default function Overview() {
  return (
    <>
      <PageHead
        section="Overview"
        title="The protocol, in full."
        lede="A no-loss prize savings pool where balances, ticket ranges and winnings are encrypted, and the draw is still something anyone can check. These pages describe what is deployed and verified on Sepolia today, not what is planned."
      />

      <H2>What it is</H2>
      <P>
        You deposit a confidential token. Nothing is lent out and nothing is at risk: the prize is funded separately and
        drawn periodically, so not winning costs you nothing and your principal stays yours. You can withdraw in every
        phase of every draw, including while a draw is mid-flight.
      </P>
      <P>
        What is unusual is how little of it is legible. Your balance is a ciphertext from the moment it lands. The
        ticket range that sets your odds is computed over ciphertext. The prize credited to you is encrypted, and so is
        the zero credited to everyone else — which is what makes the winner unidentifiable, since a winning claim and a
        losing claim are the same transaction doing the same work.
      </P>
      <P>
        Two numbers do become public, deliberately: the weighted ticket total for an epoch, and the winning ticket
        number drawn against it. That pair is exactly what an auditor needs to confirm the draw was honest, and on its
        own it identifies nobody.
      </P>

      <Callout label="Status">
        Deployed to Ethereum Sepolia with test assets only. 33 passing tests covering the full cycle, every recovery
        path and the chunk boundary. Not audited by a third party, and not somewhere to put real savings. Prizes come
        from an admin-funded reserve rather than a live yield source, which the brief permits; a yield adapter plugs in
        behind the same function.
      </Callout>

      <H2>What is in here</H2>
      <P>
        Ten short pages, in reading order. The arrows at the foot of each one follow that order, so it can be read
        straight through, and the contents will take you anywhere out of sequence.
      </P>

      <div className="mt-8">
        {DOCS.map((group) => (
          <div key={group.label} className="mt-8 first:mt-0">
            <p className="eyebrow">{group.label}</p>
            <ul className="mt-3">
              {group.pages
                .filter((page) => page.href !== "/docs")
                .map((page) => (
                  <li key={page.href} className="border-t border-line">
                    <Link href={page.href} className="group block py-3.5">
                      <p className="text-[0.875rem] text-clear transition-colors group-hover:text-glow">{page.label}</p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{page.blurb}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
