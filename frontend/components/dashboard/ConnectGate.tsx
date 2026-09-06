"use client";

import { useConnect, useSwitchChain } from "wagmi";

import { Button } from "@/components/dashboard/ui";
import { SEPOLIA_CHAIN_ID } from "@/lib/config";
import type { Pool } from "@/components/dashboard/usePool";

/**
 * Whether a page should show the gate instead of its own content.
 *
 * This is a plain predicate rather than something read off the rendered element. `<ConnectGate />`
 * is a React element whether or not it renders anything, and an element is always truthy — so
 * `const gate = <ConnectGate />; if (gate) return gate;` returns the gate in every case, and a
 * connected user got a page that rendered null. Every tab except the ungated one went blank.
 */
export function needsWallet(pool: Pool): boolean {
  return !pool.isConnected || pool.onWrongNetwork;
}

/**
 * Stands in front of a dashboard page until there is a wallet on the right network.
 *
 * Each page renders this rather than the layout doing it once, because a page needs the pool data
 * anyway and this keeps a page's connected and disconnected states in the same file.
 */
export function ConnectGate({ pool }: { pool: Pool }) {
  const { connect, connectors, isPending } = useConnect();
  const { switchChain } = useSwitchChain();

  if (!pool.isConnected) {
    return (
      <section>
        <p className="eyebrow">Wallet needed</p>
        <h1 className="display mt-3 text-[1.375rem] text-clear">Connect a wallet to go further</h1>
        <p className="mt-3 max-w-[58ch] text-[0.875rem] leading-relaxed text-muted">
          Everything on the overview is public and needs no wallet. These pages show your own encrypted balance, so
          there is nothing to show until one is connected.
        </p>
        <div className="mt-6">
          <Button
            primary
            busy={isPending}
            onClick={() => {
              const injected = connectors[0];
              if (injected) connect({ connector: injected });
            }}
          >
            Connect wallet
          </Button>
        </div>
        <p className="mt-4 max-w-[58ch] text-xs leading-relaxed text-muted">
          No wallet in this browser? Install one, or open this page inside your wallet&apos;s own browser, then reload.
        </p>
      </section>
    );
  }

  if (pool.onWrongNetwork) {
    return (
      <section>
        <p className="eyebrow">Wrong network</p>
        <h1 className="display mt-3 text-[1.375rem] text-clear">Tenure runs on Sepolia</h1>
        <p className="mt-3 max-w-[58ch] text-[0.875rem] leading-relaxed text-muted">
          Switch your wallet to Sepolia and this page will fill in. The chain id is {SEPOLIA_CHAIN_ID}.
        </p>
        <div className="mt-6">
          <Button primary onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
            Switch to Sepolia
          </Button>
        </div>
      </section>
    );
  }

  return null;
}
