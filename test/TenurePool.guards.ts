import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { MockUSDC, MockCUSDC } from "../types";

/**
 * Constructor guards on the timing windows.
 *
 * `DRAW_TIMEOUT` and `CLAIM_WINDOW` are deployment parameters so a demo can complete a cycle
 * quickly, but a degenerate value is a real hazard rather than a merely odd configuration:
 * a zero claim window makes the prize rollable in the same block it becomes claimable, so a
 * winner could never realistically take it.
 */
describe("TenurePool timing guards", function () {
  let cusdcAddress: string;
  let deployer: string;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
    const signers = await ethers.getSigners();
    deployer = signers[0].address;

    const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
    await usdc.waitForDeployment();
    const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;
    await cusdc.waitForDeployment();
    cusdcAddress = await cusdc.getAddress();
  });

  async function deployWith(drawTimeout: number, claimWindow: number) {
    const factory = await ethers.getContractFactory("TenurePool");
    return factory.deploy(cusdcAddress, deployer, drawTimeout, claimWindow);
  }

  it("rejects a zero claim window", async function () {
    await expect(deployWith(600, 0)).to.be.revertedWithCustomError(
      await ethers.getContractFactory("TenurePool"),
      "InvalidTiming",
    );
  });

  it("rejects a zero draw timeout", async function () {
    await expect(deployWith(0, 600)).to.be.revertedWithCustomError(
      await ethers.getContractFactory("TenurePool"),
      "InvalidTiming",
    );
  });

  it("rejects a window below the minimum", async function () {
    await expect(deployWith(600, 59)).to.be.revertedWithCustomError(
      await ethers.getContractFactory("TenurePool"),
      "InvalidTiming",
    );
  });

  it("accepts exactly the minimum", async function () {
    const pool = await deployWith(60, 60);
    await pool.waitForDeployment();
    expect(await pool.DRAW_TIMEOUT()).to.eq(60);
    expect(await pool.CLAIM_WINDOW()).to.eq(60);
  });

  it("stores the deployed demo values", async function () {
    const pool = await deployWith(600, 600);
    await pool.waitForDeployment();
    expect(await pool.MIN_WINDOW()).to.eq(60);
    expect(await pool.DRAW_TIMEOUT()).to.eq(600);
    expect(await pool.CLAIM_WINDOW()).to.eq(600);
  });
});
