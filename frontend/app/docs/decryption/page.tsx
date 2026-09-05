import type { Metadata } from "next";

import { PageHead, H2, P, Row } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "Decryption without an oracle — Tenure",
  description: "How the total and the winning number cross into plaintext, and why nobody has to be trusted for it.",
};

export default function Decryption() {
  return (
    <>
      <PageHead
        section="Decryption without an oracle"
        title="Decryption without an oracle."
        lede="Two values have to cross from ciphertext into plaintext for a draw to complete: the weighted total, and the winning number. Neither goes through a callback oracle."
      />

      <H2>Three steps</H2>
      <P>
        The callback path was deprecated in v0.9 of the protocol and removed. The supported flow is self-relaying, and
        it puts the verification on-chain rather than the trust off it.
      </P>
      <div className="mt-6">
        <Row term="FHE.makePubliclyDecryptable(h)">On-chain. Marks one handle as something anyone may decrypt.</Row>
        <Row term="sdk.publicDecrypt([h])">
          Off-chain. Returns the cleartext and a signed proof from the key-management service.
        </Row>
        <Row term="FHE.checkSignatures(...)">
          On-chain. Verifies the proof against the handle before the value is trusted. A forged total cannot get past
          this, so the submitter is untrusted by construction.
        </Row>
      </div>

      <H2>What follows from it</H2>
      <P>
        Nothing external has to fire for a draw to complete, so there is no oracle liveness risk — the machine only
        stalls if nobody chooses to advance it, and that has its own escape. No caller ever needs to send value either,
        because the fee belonged to the callback path that no longer exists.
      </P>
      <P>
        The cost is that somebody has to actually fetch each decryption and submit it. A keeper is mandatory
        infrastructure here rather than a convenience, which is why one ships with the repository and why triggering the
        phases by hand is documented as the fallback rather than left as an exercise.
      </P>
    </>
  );
}
