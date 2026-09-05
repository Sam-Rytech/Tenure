import type { Metadata } from "next";

import { PageHead, H2, P, Step, Callout } from "@/components/docs/DocsUI";

export const metadata: Metadata = {
  title: "Try it on Sepolia — Tenure",
  description: "From an empty wallet to a position in the pool, in six steps.",
};

export default function Quickstart() {
  return (
    <>
      <PageHead
        section="Try it on Sepolia"
        title="Try it on Sepolia."
        lede="Everything on the landing page — the live epoch, the published total, the winning number — reads without a wallet. You only need one to take a position."
      />

      <H2>Six steps</H2>
      <ol className="mt-6 space-y-4">
        <Step n={1} title="Get Sepolia ETH">
          Any public faucet. You need a small amount for gas and nothing more; the pool itself uses a test token.
        </Step>
        <Step n={2} title="Get test cUSDC">
          One button in the app mints the public mock token, approves the wrapper and wraps it into the confidential
          token. Three transactions behind one click.
        </Step>
        <Step n={3} title="Allow the pool to move funds">
          ERC-7984 uses operators rather than ERC-20 approvals. It looks like an approval and behaves differently, which
          is why it is its own step before your first deposit.
        </Step>
        <Step n={4} title="Deposit">
          Your amount is encrypted in the browser before it is sent. The chain never sees the figure, and neither does
          anyone reading the transaction.
        </Step>
        <Step n={5} title="Reveal your balance">
          Sign once and the balance decrypts locally, for you. The signature authorises you to read your own ciphertext;
          it does not publish anything.
        </Step>
        <Step n={6} title="Claim after a draw">
          Claim whatever the result, then move the prize into your balance if there was one. Both are ordinary
          transactions that reveal nothing by being sent.
        </Step>
      </ol>

      <H2>What to expect</H2>
      <P>
        Encrypted operations are not instant. A deposit carries a proof that the browser has to generate, and a reveal
        makes a round trip to the key-management service, so each takes a few seconds longer than a plain transfer
        would. The app shows that work rather than hiding it.
      </P>

      <Callout label="If a draw is mid-flight">
        You can still deposit and still withdraw. A deposit made after an epoch closes joins the next draw rather than
        the running one, which is the anti-sniping rule doing its job; a withdrawal works in every phase, without
        exception.
      </Callout>
    </>
  );
}
