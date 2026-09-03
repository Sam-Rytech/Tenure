import { ethers, network } from "hardhat";

/**
 * Pre-deployment checks against a live network.
 *
 * Verifies the deployer is funded and, critically, that Zama's published cUSDC wrapper reports
 * `rate() == 1`. `PrizeReserve.fundEpoch` reverts on any other rate, so a mismatch here would
 * break prize funding on-chain rather than in a test.
 *
 *   npx hardhat run scripts/preflight.ts --network sepolia
 */

const ZAMA_SEPOLIA = {
  underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF", // Mock USDC, public mint
  cusdc: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639", // ERC7984ERC20Wrapper
};

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

const WRAPPER_ABI = [
  "function rate() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function underlying() view returns (address)",
];

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`network            : ${network.name} (chainId ${net.chainId})`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`deployer           : ${deployer.address}`);
  console.log(`balance            : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("\n  [FAIL] deployer has no ETH; fund it before deploying.");
  } else if (balance < ethers.parseEther("0.02")) {
    console.log("\n  [WARN] balance is low for several FHE deploys; 0.05+ ETH is safer.");
  }

  if (net.chainId !== 11155111n) {
    console.log("\nSkipping token checks: not Sepolia.");
    return;
  }

  console.log("");
  const underlyingCode = await ethers.provider.getCode(ZAMA_SEPOLIA.underlying);
  const cusdcCode = await ethers.provider.getCode(ZAMA_SEPOLIA.cusdc);
  console.log(`underlying deployed: ${underlyingCode !== "0x" ? "yes" : "NO"}`);
  console.log(`cUSDC deployed     : ${cusdcCode !== "0x" ? "yes" : "NO"}`);
  if (underlyingCode === "0x" || cusdcCode === "0x") {
    console.log("\n  [FAIL] a published Zama token is missing at its documented address.");
    return;
  }

  const underlying = new ethers.Contract(ZAMA_SEPOLIA.underlying, ERC20_ABI, ethers.provider);
  const cusdc = new ethers.Contract(ZAMA_SEPOLIA.cusdc, WRAPPER_ABI, ethers.provider);

  const uDecimals: bigint = BigInt(await underlying.decimals());
  const uSymbol: string = await underlying.symbol();
  const uBalance: bigint = await underlying.balanceOf(deployer.address);
  console.log(`underlying         : ${uSymbol}, ${uDecimals} decimals`);
  console.log(`deployer holds     : ${ethers.formatUnits(uBalance, uDecimals)} ${uSymbol}`);

  const wrapped: string = await cusdc.underlying();
  const rate: bigint = await cusdc.rate();
  const cDecimals: bigint = BigInt(await cusdc.decimals());
  console.log(`cUSDC wraps        : ${wrapped}`);
  console.log(`cUSDC decimals     : ${cDecimals}`);
  console.log(`cUSDC rate()       : ${rate}`);

  console.log("");
  if (wrapped.toLowerCase() !== ZAMA_SEPOLIA.underlying.toLowerCase()) {
    console.log("  [FAIL] cUSDC does not wrap the underlying we expect.");
  }
  if (rate === 1n) {
    console.log("  [OK]   rate() == 1, so PrizeReserve.fundEpoch will work as written.");
  } else {
    console.log(`  [FAIL] rate() == ${rate}. PrizeReserve reverts with UnsupportedRate(${rate}).`);
    console.log("         fundEpoch must scale underlying units by rate before wrapping.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
