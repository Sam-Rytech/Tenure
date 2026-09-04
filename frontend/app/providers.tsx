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

const wagmiConfig = createWagmiConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC_URL) },
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
