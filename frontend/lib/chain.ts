import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

import { ADDRESSES, RPC_URL } from "./config";
import { TENURE_POOL_ABI } from "./abi";

/**
 * A read-only Sepolia client.
 *
 * Used for everything the draw-audit surface needs, which is the whole point of that surface:
 * anyone can verify a past draw with no wallet, no signature and no connection.
 *
 * Reads are batched through Multicall3. The audit panel needs a dozen values, and issuing them as
 * separate eth_call round trips against a public endpoint took nearly 40 seconds — slow enough
 * that the page looked broken. Batching collapses that into two requests.
 */
export const publicClient = createPublicClient({
  chain: sepolia,
  // No JSON-RPC array batching here: several public endpoints reject batched arrays outright.
  // Multicall below achieves the same saving through a single eth_call.
  transport: http(RPC_URL, {
    timeout: 15_000,
    retryCount: 2,
  }),
  batch: { multicall: { wait: 16 } },
});

export interface DrawState {
  currentEpoch: number;
  phase: number;
  drawTimeout: bigint;
  claimWindow: bigint;
  participantCount: bigint;
  /** The epoch whose draw is published, if any. */
  drawnEpoch: number | null;
  totalTickets: bigint;
  winningNumber: bigint;
  prizeAmount: bigint;
  claimDeadline: bigint;
  claimCount: bigint;
}

const pool = {
  address: ADDRESSES.pool,
  abi: TENURE_POOL_ABI,
} as const;

/** Per-epoch values, read for a candidate epoch. */
function epochCalls(epoch: number) {
  return [
    { ...pool, functionName: "epochTotalTickets", args: [epoch] },
    { ...pool, functionName: "epochWinningNumber", args: [epoch] },
    { ...pool, functionName: "prizeAmount", args: [epoch] },
    { ...pool, functionName: "epochClaimDeadline", args: [epoch] },
    { ...pool, functionName: "epochClaimCount", args: [epoch] },
  ] as const;
}

/**
 * Reads everything the audit panel shows, in two batched round trips.
 *
 * The most recently drawn epoch is not always the current one: once a claim window closes the pool
 * advances, so both the current epoch and the one before it are fetched and the drawn one wins.
 */
export async function readDrawState(): Promise<DrawState> {
  const [currentEpochRaw, phaseRaw, drawTimeout, claimWindow, participantCount] = await Promise.all([
    publicClient.readContract({ ...pool, functionName: "currentEpoch" }),
    publicClient.readContract({ ...pool, functionName: "phase" }),
    publicClient.readContract({ ...pool, functionName: "DRAW_TIMEOUT" }),
    publicClient.readContract({ ...pool, functionName: "CLAIM_WINDOW" }),
    publicClient.readContract({ ...pool, functionName: "participantCount" }),
  ]);

  const currentEpoch = Number(currentEpochRaw);
  const previousEpoch = currentEpoch > 0 ? currentEpoch - 1 : null;

  // Fetch both candidates at once rather than probing one, then the other.
  const [current, previous] = await Promise.all([
    Promise.all(epochCalls(currentEpoch).map((call) => publicClient.readContract(call))),
    previousEpoch === null
      ? Promise.resolve(null)
      : Promise.all(epochCalls(previousEpoch).map((call) => publicClient.readContract(call))),
  ]);

  const currentHasDraw = (current[0] as bigint) > 0n;
  const previousHasDraw = previous !== null && (previous[0] as bigint) > 0n;

  const chosen = currentHasDraw ? current : previousHasDraw ? previous! : current;
  const drawnEpoch = currentHasDraw ? currentEpoch : previousHasDraw ? previousEpoch : null;

  return {
    currentEpoch,
    phase: Number(phaseRaw),
    drawTimeout: drawTimeout as bigint,
    claimWindow: claimWindow as bigint,
    participantCount: participantCount as bigint,
    drawnEpoch,
    totalTickets: chosen[0] as bigint,
    winningNumber: chosen[1] as bigint,
    prizeAmount: chosen[2] as bigint,
    claimDeadline: chosen[3] as bigint,
    claimCount: chosen[4] as bigint,
  };
}
