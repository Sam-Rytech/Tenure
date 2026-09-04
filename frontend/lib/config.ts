/** Sepolia chain id. Tenure is testnet-only. */
export const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Deployed addresses.
 *
 * Overridable through env so a redeploy does not need a code change. Defaults point at the
 * current public deployment.
 */
export const ADDRESSES = {
  pool: (process.env.NEXT_PUBLIC_POOL_ADDRESS ?? "0x6c36d9b70954029D66032FEF2A4880b22a53AF9e") as `0x${string}`,
  reserve: (process.env.NEXT_PUBLIC_RESERVE_ADDRESS ??
    "0xd8701a0040032f3633E740Ce111dc50C3f84Bc79") as `0x${string}`,
  /** Zama's published cUSDC wrapper. */
  cusdc: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639" as `0x${string}`,
  /** Zama's published Mock USDC, which anyone may mint. This is the faucet. */
  underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF" as `0x${string}`,
};

/**
 * A public Sepolia endpoint, used so the draw-audit panel works with no wallet connected.
 *
 * Deliberately not the project's Infura key: anything prefixed NEXT_PUBLIC_ is compiled into the
 * browser bundle and would be readable by every visitor.
 */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export const EXPLORER = "https://sepolia.etherscan.io";

/** cUSDC uses six decimals, matching the underlying. */
export const DECIMALS = 6;

/** Mirrors DrawEngine.Phase. */
export const PHASE_LABELS = [
  "Open for deposits",
  "Building the ticket ladder",
  "Awaiting the published total",
  "Awaiting the winning number",
  "Claimable",
] as const;

/** Tenure tiers, as multipliers. Mirrors TenurePool.tierShifts of [0,1,2,3]. */
export const TIER_LABELS = ["1x", "2x", "4x", "8x"] as const;

export function tierLabelForShift(shift: number): string {
  return TIER_LABELS[Math.min(shift, TIER_LABELS.length - 1)] ?? "1x";
}

/** Format a 6-decimal base-unit amount for display. */
export function formatUnits6(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  const body = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}

/** Parse a user-entered decimal amount into 6-decimal base units. */
export function parseUnits6(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > DECIMALS) return null;
  return BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, DECIMALS) || "0");
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function shorten(value: string, lead = 6, tail = 4): string {
  return value.length <= lead + tail + 2 ? value : `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
