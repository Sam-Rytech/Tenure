import type { Metadata } from "next";
import Link from "next/link";

import { Nav } from "@/components/Nav";
import { DocsSidebar, type DocsGroup } from "@/components/DocsSidebar";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { ADDRESSES, SEPOLIA_CHAIN_ID, addressUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Documentation — Tenure",
  description:
    "How Tenure works: the five-phase draw, the encrypted ticket ladder, tenure weighting, the confidentiality boundary, decryption without an oracle, and the deployed Sepolia contracts.",
};

/*
 * Documentation.
 *
 * One page rather than a route per topic. The whole protocol is four contracts, and splitting it
 * across nine routes would mean nine screens a reader has to reassemble — the sticky contents
 * gives the same navigation without the reassembly, and Ctrl-F still finds everything.
 *
 * Nothing here animates in. The landing page argues; documentation is read, often in a hurry and
 * sometimes by a judge with a deadline, and content that waits for a scroll trigger is content
 * that can fail to arrive.
 */

const GROUPS: DocsGroup[] = [
  {
    label: "Start here",
    items: [
      { id: "what-it-is", label: "What it is" },
      { id: "five-phases", label: "A draw in five phases" },
      { id: "try-it", label: "Try it on Sepolia" },
    ],
  },
  {
    label: "Protocol",
    items: [
      { id: "ladder", label: "The ticket ladder" },
      { id: "tenure", label: "Tenure weighting" },
      { id: "boundary", label: "Public and encrypted" },
      { id: "decryption", label: "Decryption without an oracle" },
      { id: "stalls", label: "When something stalls" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "cost", label: "Homomorphic cost" },
      { id: "deployments", label: "Deployed contracts" },
    ],
  },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-28 first:mt-0">
      <h2 className="display group text-[1.625rem] text-clear sm:text-[1.875rem]">
        {title}
        <a
          href={`#${id}`}
          aria-label={`Link to ${title}`}
          className="ml-2.5 align-middle font-mono text-[0.8125rem] text-line-bright opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          #
        </a>
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[68ch] text-[0.875rem] leading-relaxed text-muted first:mt-0">{children}</p>;
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel mt-6 p-5 sm:p-6">
      <p className="eyebrow !text-glow">{label}</p>
      <p className="mt-2.5 max-w-[64ch] text-[0.875rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/** A call and what it does. The call is the label, so it stays in the mono column. */
function Row({ call, children }: { call: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-4 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-8">
      <code className="font-mono text-[0.8125rem] text-clear">{call}</code>
      <p className="text-[0.875rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Figure({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="font-mono text-[1.375rem] tabular-nums text-clear">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function AddressRow({ label, address, note }: { label: string; address: string; note: string }) {
  return (
    <div className="grid gap-2 border-t border-line py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8">
      <p className="text-[0.875rem] text-clear">{label}</p>
      <div className="min-w-0">
        <a
          href={addressUrl(address)}
          className="block break-all font-mono text-[0.8125rem] text-glow underline-offset-4 hover:underline"
        >
          {address}
        </a>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{note}</p>
      </div>
    </div>
  );
}

export default function Docs() {
  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <DocsSidebar groups={GROUPS} />

          <article className="mt-10 min-w-0 lg:mt-0">
            <p>
              <span className="eyebrow">Docs</span>
              <span aria-hidden className="mx-2.5 text-line-bright">
                ·
              </span>
              <span className="eyebrow">Overview</span>
            </p>

            <h1 className="display mt-5 text-[clamp(2rem,5.5vw,3rem)]">The protocol, in full.</h1>

            <p className="mt-5 max-w-[62ch] text-[1rem] leading-relaxed text-muted">
              A no-loss prize savings pool where balances, ticket ranges and winnings are encrypted, and the draw is
              still something anyone can check. These pages describe what is deployed and verified on Sepolia today, not
              what is planned.
            </p>

            <div className="mt-14">
              {/* ───────────────────────────────────────── what it is ── */}
              <Section id="what-it-is" title="What it is">
                <P>
                  You deposit a confidential token. Nothing is lent out and nothing is at risk: the prize is funded
                  separately and drawn periodically, so not winning costs you nothing and your principal stays yours.
                  You can withdraw in every phase of every draw, including while a draw is mid-flight.
                </P>
                <P>
                  What is unusual is how little of it is legible. Your balance is a ciphertext from the moment it lands.
                  The ticket range that sets your odds is computed over ciphertext. The prize credited to you is
                  encrypted, and so is the zero credited to everyone else — which is what makes the winner
                  unidentifiable, since a winning claim and a losing claim are the same transaction doing the same work.
                </P>
                <P>
                  Two numbers do become public, deliberately: the weighted ticket total for an epoch, and the winning
                  ticket number drawn against it. That pair is exactly what an auditor needs to confirm the draw was
                  honest, and on its own it identifies nobody.
                </P>
                <Callout label="Status">
                  Deployed to Ethereum Sepolia with test assets only. 33 passing tests covering the full cycle, every
                  recovery path, and the chunk boundary. Not audited by a third party, and not somewhere to put real
                  savings. Prizes come from an admin-funded reserve rather than a live yield source, which the brief
                  permits; a yield adapter plugs in behind the same function.
                </Callout>
              </Section>

              {/* ──────────────────────────────────────── five phases ── */}
              <Section id="five-phases" title="A draw in five phases">
                <P>
                  A draw is a state machine, and every transition is permissionless — anyone can push it forward, and
                  none of them require a payment. Whoever advances the machine chooses the timing, never the outcome.
                </P>
                <div className="mt-8">
                  <Row call="closeEpoch()">
                    Ends deposits for the epoch and snapshots the participant list.{" "}
                    <span className="text-clear">Open → Ladder build.</span> Reverts unless the prize is already funded,
                    so a winner can never be credited from an empty reserve.
                  </Row>
                  <Row call="buildChunk()">
                    Extends the encrypted ticket ladder by up to twenty savers. Called as many times as it takes.{" "}
                    <span className="text-clear">Ladder build → Total pending</span> on the last chunk, which also marks
                    the running total publicly decryptable.
                  </Row>
                  <Row call="submitTotal(total, proof)">
                    Verifies the decryption signatures, then draws randomness on-chain and reduces it against the
                    now-plaintext total. <span className="text-clear">Total pending → Winner pending.</span> The draw
                    lives here rather than in its own call because randomness cannot be reduced before the total exists.
                  </Row>
                  <Row call="submitWinner(w, proof)">
                    Verifies the winning number and publishes it.{" "}
                    <span className="text-clear">Winner pending → Claimable.</span> Ticket ranges stay encrypted, so the
                    number cannot be traced back to a person.
                  </Row>
                  <Row call="claimPrize()">
                    Credits an encrypted amount — the prize if the number landed in your range, an encrypted zero if it
                    did not. Everyone runs the same code and the contract itself cannot tell the two apart.
                  </Row>
                  <Row call="withdrawPrize()">
                    Moves a credited prize into your spendable balance, whenever you choose to.
                  </Row>
                  <Row call="abortDraw()">
                    Resets a stalled draw to open and rolls the prize forward. Permissionless, and only callable once
                    the timeout has passed. <span className="text-clear">Any phase → Open.</span>
                  </Row>
                </div>
              </Section>

              {/* ───────────────────────────────────────────── try it ── */}
              <Section id="try-it" title="Try it on Sepolia">
                <P>
                  Everything on the landing page — the live epoch, the published total, the winning number — reads
                  without a wallet. You only need one to take a position.
                </P>
                <ol className="mt-6 space-y-4">
                  {[
                    ["Get Sepolia ETH", "Any public faucet. You need a small amount for gas, nothing more."],
                    [
                      "Get test cUSDC",
                      "One button in the app mints the public mock token, approves the wrapper and wraps it into the confidential token. Three transactions behind one click.",
                    ],
                    [
                      "Allow the pool to move funds",
                      "ERC-7984 uses operators rather than ERC-20 approvals. It looks like an approval and behaves differently, which is why it is its own step before your first deposit.",
                    ],
                    [
                      "Deposit",
                      "Your amount is encrypted in the browser before it is sent. The chain never sees the figure.",
                    ],
                    [
                      "Reveal your balance",
                      "Sign once and the balance decrypts locally, for you. The signature authorises you to read your own ciphertext; it does not publish anything.",
                    ],
                    [
                      "Claim after a draw",
                      "Claim whatever the result, then move the prize into your balance if there was one. Both are ordinary transactions that reveal nothing by being sent.",
                    ],
                  ].map(([title, body], i) => (
                    <li key={title} className="grid gap-1.5 border-t border-line pt-4 sm:grid-cols-[2.5rem_1fr]">
                      <span className="section-index">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <p className="text-[0.875rem] text-clear">{title}</p>
                        <p className="mt-1.5 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              {/* ───────────────────────────────────────────── ladder ── */}
              <Section id="ladder" title="The ticket ladder">
                <P>
                  Each saver holds a half-open ticket range whose width is their weighted balance. The ranges are laid
                  end to end, so they are disjoint and together cover everything from zero to the total. Draw a number
                  below the total and it falls inside exactly one range — which is the whole selection mechanism, and
                  the reason at most one person can ever be in range.
                </P>
                <P>
                  Building it is a running sum, and a running sum is inherently sequential: each range starts where the
                  previous one ended. Under homomorphic encryption that chain is the binding cost, which is why the
                  ladder is built twenty savers at a time across as many transactions as needed. The pool is therefore
                  not capped by what fits in a single block.
                </P>
                <P>
                  A saver who is ineligible or holds nothing is given an empty range rather than being skipped. An empty
                  range cannot be drawn, and keeping it preserves the index of everyone after it — the alternative is a
                  compacting list, whose indices shift under you between chunks.
                </P>
              </Section>

              {/* ───────────────────────────────────────────── tenure ── */}
              <Section id="tenure" title="Tenure weighting">
                <P>
                  Encryption removes what a sniper reads. Tenure removes what they read it for. Hold across an epoch
                  boundary and your ticket range doubles; hold four and it is eight times what it started at. The
                  multiplier is a bit-shift on the encrypted balance, so it costs almost nothing and never leaves
                  ciphertext.
                </P>
                <div className="mt-8">
                  <Row call="tier 0 — 1x">New this epoch.</Row>
                  <Row call="tier 1 — 2x">Held across one epoch boundary.</Row>
                  <Row call="tier 2 — 4x">Held across two or three.</Row>
                  <Row call="tier 3 — 8x">Held across four or more.</Row>
                </div>
                <P>
                  Any deposit or withdrawal resets you to tier zero. There is no way to park dust for months and then
                  arrive large the block before a draw, which is the exact strategy that transparent prize pools have to
                  survive.
                </P>
                <P>
                  The tiers are a deployment parameter, not a rule welded into the contract. Set them all equal and
                  Tenure reduces exactly to strict deposit-weighting — canonical PoolTogether. That equivalence is
                  asserted by a test rather than claimed here.
                </P>
              </Section>

              {/* ─────────────────────────────────────────── boundary ── */}
              <Section id="boundary" title="Public and encrypted">
                <P>
                  Confidentiality claims are easy to make and hard to keep once money moves. This is the line as
                  deployed, including the parts that are less flattering.
                </P>
                <div className="mt-8 grid gap-10 sm:grid-cols-2">
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
                <Callout label="What still leaks">
                  Participation is visible even though amounts are not — Tenure hides balances and outcomes, not the act
                  of taking part. The published total loosely bounds how much is in the pool. With very few savers, an
                  observer who already knows some balances can narrow the field, which is true of any pool. And because
                  awards are encrypted, the contract cannot tell a winning claim from a losing one, which is why an
                  unclaimed prize only rolls forward when nobody claimed at all.
                </Callout>
              </Section>

              {/* ───────────────────────────────────────── decryption ── */}
              <Section id="decryption" title="Decryption without an oracle">
                <P>
                  Two values have to cross from ciphertext into plaintext for a draw to complete: the weighted total,
                  and the winning number. Neither goes through a callback oracle. That path was deprecated in v0.9 of
                  the protocol and removed; the supported flow is self-relaying, in three steps.
                </P>
                <div className="mt-8">
                  <Row call="FHE.makePubliclyDecryptable(h)">
                    On-chain. Marks one handle as something anyone may decrypt.
                  </Row>
                  <Row call="sdk.publicDecrypt([h])">
                    Off-chain. Returns the cleartext and a signed proof from the key-management service.
                  </Row>
                  <Row call="FHE.checkSignatures(...)">
                    On-chain. Verifies the proof against the handle before the value is trusted. A forged total cannot
                    get past this, so the submitter is untrusted by construction.
                  </Row>
                </div>
                <P>
                  This has three consequences worth stating. Nothing external has to fire for a draw to complete, so
                  there is no oracle liveness risk. No caller ever needs to send value, because the fee belonged to the
                  callback path that no longer exists. And someone has to actually fetch each decryption and submit it —
                  a keeper is mandatory infrastructure here rather than a convenience, which is why one ships with the
                  repository and why manual triggering is documented as the fallback.
                </P>
              </Section>

              {/* ───────────────────────────────────────────── stalls ── */}
              <Section id="stalls" title="When something stalls">
                <P>
                  A draw waits on people at two points, and people are not reliable. Every waiting phase records when it
                  was entered, and one permissionless call releases all of them.
                </P>
                <div className="mt-8">
                  <Row call="Nobody submits a decryption">
                    <span className="text-clear">abortDraw()</span> after the timeout. The prize rolls forward and the
                    epoch reopens. The same call covers a ladder that stopped mid-build.
                  </Row>
                  <Row call="Nobody deposited">Closing rolls the epoch over without entering the machine at all.</Row>
                  <Row call="The total decrypts to zero">
                    Aborts and rolls forward, so the reduction is never handed a zero divisor.
                  </Row>
                  <Row call="A submission is replayed">
                    A no-op — the phase check rejects it, and the proof is bound to its handle regardless.
                  </Row>
                  <Row call="A prize is never claimed">
                    Rolls forward once the claim window closes. Anyone can call it.
                  </Row>
                  <Row call="Someone claims twice">Reverts. One claim per address per epoch.</Row>
                  <Row call="You want out mid-draw">
                    Always allowed, in all five phases. Principal is never locked, and a test fails loudly if that stops
                    being true.
                  </Row>
                </div>
                <Callout label="The invariant">
                  No user action, decryption failure or draw state can make principal unrecoverable. A deposit credits
                  exactly the ciphertext the token transfer returned, so recorded liability can never exceed the funds
                  actually held.
                </Callout>
              </Section>

              {/* ─────────────────────────────────────────────── cost ── */}
              <Section id="cost" title="Homomorphic cost">
                <P>
                  Encrypted arithmetic is metered in homomorphic complexity units, with two ceilings per transaction: a
                  total, and a separate limit on the longest sequential chain. The running sum in the ladder is a
                  sequential chain by nature, so the depth ceiling is what sets the chunk size.
                </P>
                <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  <Figure value="20" label="savers per chunk" note="The ladder extends twenty at a time." />
                  <Figure
                    value="3.24M"
                    label="depth per chunk"
                    note="Against a 5M ceiling — 35% headroom at the chosen size."
                  />
                  <Figure
                    value="1.18M"
                    label="the draw itself"
                    note="Generating randomness and reducing it against the total."
                  />
                </div>
                <P>
                  These are the published costs of the operations involved rather than estimates, and the chunk boundary
                  is covered by tests at nineteen, twenty and twenty-one participants — one under, exactly on, and one
                  over — because an off-by-one there would silently drop a saver from a draw.
                </P>
              </Section>

              {/* ──────────────────────────────────────── deployments ── */}
              <Section id="deployments" title="Deployed contracts">
                <P>
                  Ethereum Sepolia, chain id {SEPOLIA_CHAIN_ID}. Both Tenure contracts are verified, so the source on
                  Etherscan is the source that runs.
                </P>
                <div className="mt-8">
                  <AddressRow
                    label="TenurePool"
                    address={ADDRESSES.pool}
                    note="Balances, tenure tiers, the draw machine and claims."
                  />
                  <AddressRow
                    label="PrizeReserve"
                    address={ADDRESSES.reserve}
                    note="Holds the prize and wraps it into the pool. Funding fails loudly rather than silently."
                  />
                  <AddressRow
                    label="cUSDC"
                    address={ADDRESSES.cusdc}
                    note="Zama's published confidential wrapper. Six decimals, matching the underlying."
                  />
                  <AddressRow
                    label="Mock USDC"
                    address={ADDRESSES.underlying}
                    note="Zama's published test token. Anyone may mint it; this is the faucet."
                  />
                </div>
              </Section>
            </div>

            {/* ───────────────────────────────────────────────── next ── */}
            <div className="panel mt-16 p-6 sm:p-8">
              <p className="eyebrow">Next</p>
              <h2 className="display mt-3 max-w-[20ch] text-[clamp(1.5rem,3.4vw,2.25rem)]">
                Read the code, or take a position.
              </h2>
              <p className="mt-4 max-w-[58ch] text-[0.875rem] leading-relaxed text-muted">
                Everything above is in four Solidity files and a keeper script. The tests are the honest part: they
                cover the failure paths, not just the happy one.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <InteractiveHoverButton href="/app" text="Enter the pool" />
                <a
                  href="https://github.com/Sam-Rytech/Tenure"
                  className="btn btn-ghost"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Read the code
                </a>
              </div>
            </div>

            <footer className="hairline mt-16 pt-6">
              <p className="text-xs leading-relaxed text-muted">
                Testnet only. Built on the Zama Protocol for the Zama Developer Program.{" "}
                <Link href="/" className="text-clear underline-offset-4 hover:text-glow hover:underline">
                  Back to the overview
                </Link>
                .
              </p>
            </footer>
          </article>
        </div>
      </main>
    </>
  );
}
