import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Deploys Tenure.
 *
 * Only two contracts are ours. The confidential token is Zama's published cUSDC wrapper, which we
 * deliberately reuse rather than deploying our own: it is one fewer contract to audit, and it
 * gives judges a public faucet (mint the underlying, then wrap) with no extra step from us.
 *
 * The pool and the reserve each need the other's address, so the pool is deployed first and wired
 * afterwards through its one-shot `setReserve`. Predicting CREATE addresses would be the
 * alternative and it breaks the moment a nonce shifts.
 */

/**
 * Timing windows, in seconds.
 *
 * Short by design for the public demo: a whole cycle has to complete inside a screen recording,
 * and judges need to click through one themselves. A production deployment would use hours for
 * the stall timeout and days for the claim window. Override with DRAW_TIMEOUT / CLAIM_WINDOW.
 */
const DRAW_TIMEOUT = Number(process.env.DRAW_TIMEOUT ?? 600); // 10 minutes
const CLAIM_WINDOW = Number(process.env.CLAIM_WINDOW ?? 600); // 10 minutes

/**
 * Tenure weighting, as a left-shift per tier: 1x, 2x, 4x, 8x.
 *
 * Set TIER_SHIFTS=0,0,0,0 to deploy strict deposit-weighting instead, which is canonical
 * PoolTogether behaviour and is asserted equivalent in the tests.
 */
const TIER_SHIFTS = (process.env.TIER_SHIFTS ?? "0,1,2,3").split(",").map((v) => Number(v.trim()));

/** Zama's published Sepolia deployment. */
const ZAMA_SEPOLIA = {
  underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
  cusdc: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get, log } = hre.deployments;
  const { ethers } = hre;

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const isSepolia = chainId === 11155111;

  // On a local chain there is no published Zama token, so stand up the mocks instead.
  let underlying: string;
  let cusdc: string;

  if (isSepolia) {
    underlying = ZAMA_SEPOLIA.underlying;
    cusdc = ZAMA_SEPOLIA.cusdc;
    log(`Using Zama's published tokens: underlying=${underlying} cUSDC=${cusdc}`);
  } else {
    const mockUsdc = await deploy("MockUSDC", { from: deployer, log: true });
    const mockCusdc = await deploy("MockCUSDC", {
      from: deployer,
      args: [mockUsdc.address],
      log: true,
    });
    underlying = mockUsdc.address;
    cusdc = mockCusdc.address;
  }

  const pool = await deploy("TenurePool", {
    from: deployer,
    args: [cusdc, deployer, DRAW_TIMEOUT, CLAIM_WINDOW, TIER_SHIFTS],
    log: true,
  });

  const reserve = await deploy("PrizeReserve", {
    from: deployer,
    args: [underlying, cusdc, pool.address, deployer],
    log: true,
  });

  // Wire the pool to its reserve, exactly once.
  const poolContract = await ethers.getContractAt("TenurePool", pool.address);
  const wired = await poolContract.reserve();
  if (wired === ethers.ZeroAddress) {
    const tx = await poolContract.setReserve(reserve.address);
    await tx.wait();
    log(`setReserve(${reserve.address}) in ${tx.hash}`);
  } else if (wired.toLowerCase() !== reserve.address.toLowerCase()) {
    // One-shot by design: a redeploy of the reserve cannot be re-pointed at.
    log(`WARNING: pool is already wired to ${wired}, not ${reserve.address}`);
  } else {
    log(`Pool already wired to ${wired}`);
  }

  log("");
  log("Tenure deployed");
  log(`  underlying   ${underlying}`);
  log(`  cUSDC        ${cusdc}`);
  log(`  TenurePool   ${pool.address}`);
  log(`  PrizeReserve ${reserve.address}`);
  log(`  drawTimeout  ${DRAW_TIMEOUT}s   claimWindow ${CLAIM_WINDOW}s`);
  log(`  tierShifts   [${TIER_SHIFTS.join(", ")}]`);

  // Keep the FHECounter sample out of the way; it is template scaffolding, not part of Tenure.
  await get("TenurePool");
};

export default func;
func.id = "deploy_tenure";
func.tags = ["Tenure"];
