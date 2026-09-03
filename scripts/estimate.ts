import { ethers } from "hardhat";

/**
 * Estimates what a live Sepolia demo cycle will cost, before any ETH is moved.
 *
 * FHE transactions are gas-heavy, and the deployer holds a limited amount of test ETH, so it is
 * worth knowing the bill in advance rather than discovering it half way through a cycle.
 */
async function main() {
  const fee = await ethers.provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  console.log(`gas price (maxFee) : ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`deployer balance   : ${ethers.formatEther(balance)} ETH`);
  console.log("");

  // Rough gas budgets, taken from the local run plus headroom for FHE operations.
  const perParticipant: Array<[string, bigint]> = [
    ["mint underlying", 60_000n],
    ["approve wrapper", 50_000n],
    ["wrap to cUSDC", 400_000n],
    ["setOperator", 80_000n],
    ["deposit (FHE)", 1_400_000n],
    ["claimPrize (FHE)", 1_200_000n],
    ["withdraw (FHE)", 1_200_000n],
  ];

  const drawSteps: Array<[string, bigint]> = [
    ["fundEpoch (wrap)", 500_000n],
    ["closeEpoch x2", 300_000n],
    ["buildChunk x2", 2_000_000n],
    ["submitTotal x2", 2_500_000n],
    ["submitWinner", 900_000n],
    ["withdrawPrize (FHE)", 700_000n],
  ];

  const perParticipantGas = perParticipant.reduce((a, [, g]) => a + g, 0n);
  const drawGas = drawSteps.reduce((a, [, g]) => a + g, 0n);

  const participants = 3n;
  const totalGas = perParticipantGas * participants + drawGas;
  const totalCost = totalGas * gasPrice;

  console.log(`per participant    : ${perParticipantGas.toLocaleString()} gas`);
  console.log(`draw machinery     : ${drawGas.toLocaleString()} gas`);
  console.log(`total (3 players)  : ${totalGas.toLocaleString()} gas`);
  console.log(`estimated cost     : ${ethers.formatEther(totalCost)} ETH`);
  console.log("");

  // Each non-deployer participant needs its own gas.
  const perPlayerCost = perParticipantGas * gasPrice;
  console.log(`fund each helper   : ${ethers.formatEther(perPlayerCost)} ETH (x2 accounts)`);
  console.log(`  with 50% buffer  : ${ethers.formatEther((perPlayerCost * 3n) / 2n)} ETH each`);
  console.log("");

  if (totalCost > balance) {
    console.log(`  [FAIL] short by ~${ethers.formatEther(totalCost - balance)} ETH. Top up the faucet.`);
  } else {
    console.log(`  [OK]   affordable; ~${ethers.formatEther(balance - totalCost)} ETH would remain.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
