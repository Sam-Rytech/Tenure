"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig as createWagmiConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { createConfig as createZamaConfig } from "@zama-fhe/react-sdk/wagmi";
import { web } from "@zama-fhe/sdk/web";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk";

import { RPC_URL } from "@/lib/config";

/**
 * Client-side providers.
 *
 * Everything FHE lives below this boundary. The relayer's `web()` transport spins up a Web Worker
 * and pulls the FHE crypto from Zama's CDN, so it must never run during server rendering — which
 * is why this file is a client component and why the draw-audit surface above it deliberately
 * avoids the SDK entirely.
 */

/*
 * Sepolia with its endpoint pinned to ours.
 *
 * Setting `transports` alone is not enough: anything that reads the chain definition rather than
 * the config — and several libraries do — falls back to whatever public endpoint viem happens to
 * ship that month. Overriding the definition means every path in this app, ours or a dependency's,
 * ends up on the same endpoint we chose.
 *
 * It cannot govern the wallet. A wallet broadcasts through its own configured RPC, so if that one
 * is refusing requests the fix is in the wallet's settings; `describeError` says so by name.
 */
const chain = { ...sepolia, rpcUrls: { default: { http: [RPC_URL] } } } as const;

const wagmiConfig = createWagmiConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: http(RPC_URL) },
  ssr: true,
});

const zamaConfig = createZamaConfig({
  chains: [zamaSepolia],
  wagmiConfig,
  relayers: { [zamaSepolia.id]: web() },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain reads are cheap but the relayer is not; avoid refetch storms while a user
            // is mid-flow.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZamaProvider config={zamaConfig}>{children}</ZamaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
