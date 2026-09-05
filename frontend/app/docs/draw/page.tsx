import type { Metadata } from "next";

import { PageHead, H2, P, Row } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "A draw in five phases — Tenure",
  description: "Every call in Tenure's draw machine, what it does, and who is allowed to make it.",
};

export default function Draw() {
  return (
    <>
      <PageHead
        section="A draw in five phases"
        title="A draw in five phases."
        lede="A draw is a state machine, and every transition is permissionless — anyone can push it forward, and none of them require a payment. Whoever advances the machine chooses the timing, never the outcome."
      />

      <H2>The calls</H2>
      <div className="mt-6">
        <Row term="closeEpoch()">
          Ends deposits for the epoch and snapshots the participant list.{" "}
          <span className="text-clear">Open to Ladder build.</span> Reverts unless the prize is already funded, so a
          winner can never be credited from an empty reserve.
        </Row>
        <Row term="buildChunk()">
          Extends the encrypted ticket ladder by up to twenty savers, called as many times as it takes.{" "}
          <span className="text-clear">Ladder build to Total pending</span> on the last chunk, which also marks the
          running total publicly decryptable.
        </Row>
        <Row term="submitTotal(total, proof)">
          Verifies the decryption signatures, then draws randomness on-chain and reduces it against the now-plaintext
          total. <span className="text-clear">Total pending to Winner pending.</span>
        </Row>
        <Row term="submitWinner(w, proof)">
          Verifies the winning number and publishes it. <span className="text-clear">Winner pending to Claimable.</span>{" "}
          Ticket ranges stay encrypted, so the number cannot be traced back to a person.
        </Row>
        <Row term="claimPrize()">
          Credits an encrypted amount — the prize if the number landed in your range, an encrypted zero if it did not.
          Everyone runs the same code and the contract itself cannot tell the two apart.
        </Row>
        <Row term="withdrawPrize()">Moves a credited prize into your spendable balance, whenever you choose to.</Row>
        <Row term="abortDraw()">
          Resets a stalled draw to open and rolls the prize forward. Callable by anyone once the timeout has passed.{" "}
          <span className="text-clear">Any phase to Open.</span>
        </Row>
      </div>

      <H2>Why the draw lives inside submitTotal</H2>
      <P>
        Randomness cannot be reduced against a total that does not exist yet, so drawing has to happen after the total
        is known. Giving it its own transaction would add a state to the machine and a second place the draw could sit
        waiting for someone to act. Folding it into the call that publishes the total removes both.
      </P>
      <P>
        It costs nothing in trust. The total is checked against its decryption proof before the reduction runs, so a
        submitter who invents a total cannot get past the first statement of the function, let alone influence what
        number comes out of the second.
      </P>
    </>
  );
}
