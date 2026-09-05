import type { Metadata } from "next";

import { PageHead, H2, P, AddressRow } from "@/components/docs/DocsUI";
import { ADDRESSES, SEPOLIA_CHAIN_ID } from "@/lib/config";

export const metadata: Metadata = {
  title: "Deployed contracts — Tenure",
  description: "Verified Sepolia addresses for the Tenure pool, the prize reserve and the tokens they use.",
};

export default function Deployments() {
  return (
    <>
      <PageHead
        section="Deployed contracts"
        title="Deployed contracts."
        lede={`Ethereum Sepolia, chain id ${SEPOLIA_CHAIN_ID}. Both Tenure contracts are verified, so the source on Etherscan is the source that runs.`}
      />

      <div className="mt-10">
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

      <H2>Checking it yourself</H2>
      <P>
        The draw audit on the landing page reads these contracts directly over a public endpoint, with no wallet
        connected, so the published total and winning number can be checked against Etherscan without trusting this site
        at all. The full recorded cycle, every transaction hash included, is in the repository.
      </P>
    </>
  );
}
