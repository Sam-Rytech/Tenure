import type { Metadata } from "next";

import { PageHead, H2, P, Row, Callout } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "When something stalls — Tenure",
  description: "Every failure path in a Tenure draw, and the escape from each one.",
};

export default function Recovery() {
  return (
    <>
      <PageHead
        section="When something stalls"
        title="When something stalls."
        lede="A draw waits on people at two points, and people are not reliable. Every waiting phase records when it was entered, and one permissionless call releases all of them."
      />

      <H2>Every path out</H2>
      <div className="mt-6">
        <Row term="No decryption arrives">
          <span className="text-clear">abortDraw()</span> after the timeout. The prize rolls forward and the epoch
          reopens. The same call covers a ladder that stopped mid-build.
        </Row>
        <Row term="Nobody deposited">Closing rolls the epoch over without entering the machine at all.</Row>
        <Row term="The total decrypts to zero">
          Aborts and rolls forward, so the reduction is never handed a zero divisor.
        </Row>
        <Row term="A submission is replayed">
          A no-op — the phase check rejects it, and the proof is bound to its handle regardless.
        </Row>
        <Row term="A prize is never claimed">Rolls forward once the claim window closes. Anyone can call it.</Row>
        <Row term="Someone claims twice">Reverts. One claim per address per epoch.</Row>
        <Row term="You want out mid-draw">
          Always allowed, in all five phases. Principal is never locked, and a test fails loudly if that stops being
          true.
        </Row>
      </div>

      <H2>One abort, not several</H2>
      <P>
        An earlier design had a separate call for each stall. They turned out to be the same shape — a phase with a
        timestamp that nobody advanced — so they are one function with one timeout and one test. Fewer recovery paths is
        not a simplification for its own sake: each one is code that runs only in the rare case, which is exactly the
        code least likely to be correct.
      </P>

      <Callout label="The invariant">
        No user action, decryption failure or draw state can make principal unrecoverable. A deposit credits exactly the
        ciphertext the token transfer returned, so recorded liability can never exceed the funds actually held.
      </Callout>
    </>
  );
}
