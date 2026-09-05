"use client";

import { useAccount, useDisconnect } from "wagmi";

import { usePool } from "@/components/dashboard/usePool";
import { ConnectGate, needsWallet } from "@/components/dashboard/ConnectGate";
import { Button, Row, PageHead } from "@/components/dashboard/ui";
import { ADDRESSES, RPC_URL, SEPOLIA_CHAIN_ID, addressUrl, shorten } from "@/lib/config";

export default function Settings() {
  const pool = usePool();
  const { address, connector } = useAccount();
  const { disconnect } = useDisconnect();

  if (needsWallet(pool)) return <ConnectGate pool={pool} />;

  return (
    <>
      <PageHead
        title="Settings"
        lede="What this browser is connected to, and how to disconnect it. Nothing here is stored on a server; it is all your wallet and this page."
      />

      <section>
        <p className="eyebrow">Connection</p>
        <div className="mt-4">
          <Row label="address">{shorten(address ?? "", 10, 8)}</Row>
          <Row label="wallet">{connector?.name ?? "—"}</Row>
          <Row label="network">Sepolia · {SEPOLIA_CHAIN_ID}</Row>
          <Row label="decryption permit">{pool.hasPermit ? "signed" : "not signed yet"}</Row>
          <Row label="pool may move funds">{pool.isOperator ? "yes" : "no"}</Row>
        </div>
        <div className="mt-6">
          <Button onClick={() => disconnect()}>Disconnect wallet</Button>
        </div>
        <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-muted">
          Disconnecting only forgets the wallet in this browser. It does not move any funds and does not undo the
          permit; reconnecting picks up exactly where you left off.
        </p>
      </section>

      <section className="mt-12">
        <p className="eyebrow">If transactions start failing</p>
        <p className="mt-3 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
          Your wallet broadcasts through its own Sepolia endpoint, not this site&apos;s. Some of the defaults that
          wallets ship with have started refusing free requests, which shows up as a failure that looks like the app but
          is not. If that happens, set your wallet&apos;s Sepolia RPC to this and try again:
        </p>
        <p className="mt-3 break-all rounded-[2px] border border-line bg-raised px-3 py-2 font-mono text-[0.8125rem] text-clear">
          {RPC_URL}
        </p>
      </section>

      <section className="mt-12">
        <p className="eyebrow">Contracts</p>
        <div className="mt-4">
          <Row label="pool">
            <a
              className="hover:text-glow hover:underline"
              href={addressUrl(ADDRESSES.pool)}
              target="_blank"
              rel="noreferrer"
            >
              {shorten(ADDRESSES.pool, 10, 8)}
            </a>
          </Row>
          <Row label="reserve">
            <a
              className="hover:text-glow hover:underline"
              href={addressUrl(ADDRESSES.reserve)}
              target="_blank"
              rel="noreferrer"
            >
              {shorten(ADDRESSES.reserve, 10, 8)}
            </a>
          </Row>
          <Row label="cUSDC">
            <a
              className="hover:text-glow hover:underline"
              href={addressUrl(ADDRESSES.cusdc)}
              target="_blank"
              rel="noreferrer"
            >
              {shorten(ADDRESSES.cusdc, 10, 8)}
            </a>
          </Row>
        </div>
      </section>
    </>
  );
}
