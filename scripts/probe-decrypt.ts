import { ethers, fhevm, deployments } from "hardhat";

/**
 * Inspects exactly what the live relayer returns from `publicDecrypt`, so the keeper can pull the
 * cleartext and the KMS proof out of it reliably. The mock and the real relayer do not
 * necessarily agree on the response shape.
 *
 *   npx hardhat run scripts/probe-decrypt.ts --network sepolia
 */
async function main() {
  await fhevm.initializeCLIApi();

  const poolDeployment = await deployments.get("TenurePool");
  const pool = await ethers.getContractAt("TenurePool", poolDeployment.address);

  const phase = Number(await pool.phase());
  const names = ["OPEN", "LADDER_BUILD", "TOTAL_PENDING", "WINNER_PENDING", "CLAIMABLE"];
  console.log(`phase: ${names[phase]}`);

  const handle = phase === 3 ? await pool.encryptedWinningNumber() : await pool.encryptedTotal();
  console.log(`handle: ${handle}\n`);

  const raw: unknown = await fhevm.publicDecrypt([handle]);

  console.log("typeof            :", typeof raw);
  console.log("Array.isArray     :", Array.isArray(raw));
  if (raw && typeof raw === "object") {
    console.log("top-level keys    :", Object.keys(raw as Record<string, unknown>));
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const preview =
        typeof v === "object" && v !== null ? `${JSON.stringify(v).slice(0, 220)}` : `${String(v).slice(0, 220)}`;
      console.log(`  ${k.padEnd(20)} (${typeof v}) ${preview}`);
    }
  }

  console.log("\nfull JSON (truncated):");
  console.log(JSON.stringify(raw, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(0, 1200));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
