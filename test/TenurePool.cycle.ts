import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { MockUSDC, MockCUSDC, TenurePool, PrizeReserve } from "../types";
import { buildDecryptionProof } from "./helpers/decryption";

const PRIZE = 1_000_000n; // 1 cUSDC at 6 decimals
const OPERATOR_UNTIL = 2_000_000_000; // far-future unix timestamp
const DRAW_TIMEOUT = 2 * 60 * 60; // 2 hours
const CLAIM_WINDOW = 3 * 24 * 60 * 60; // 3 days

/** Phase enum, mirroring DrawEngine.Phase. */
const Phase = {
  OPEN: 0n,
  LADDER_BUILD: 1n,
  TOTAL_PENDING: 2n,
  WINNER_PENDING: 3n,
  CLAIMABLE: 4n,
};

async function deployFixture() {
  const [deployer, alice, bob, carol] = await ethers.getSigners();

  const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
  await usdc.waitForDeployment();

  const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;
  await cusdc.waitForDeployment();

  const pool = (await (
    await ethers.getContractFactory("TenurePool")
  ).deploy(await cusdc.getAddress(), deployer.address, DRAW_TIMEOUT, CLAIM_WINDOW)) as TenurePool;
  await pool.waitForDeployment();

  const reserve = (await (
    await ethers.getContractFactory("PrizeReserve")
  ).deploy(
    await usdc.getAddress(),
    await cusdc.getAddress(),
    await pool.getAddress(),
    deployer.address,
  )) as PrizeReserve;
  await reserve.waitForDeployment();

  await (await pool.setReserve(await reserve.getAddress())).wait();

  const poolAddress = await pool.getAddress();
  const { KMSVerifierAddress } = await fhevm.getCoprocessorConfig(poolAddress);

  return { deployer, alice, bob, carol, usdc, cusdc, pool, reserve, poolAddress, KMSVerifierAddress };
}

/** Mint underlying, wrap it to cUSDC, and approve the pool as an ERC-7984 operator. */
async function fundAndEnable(
  usdc: MockUSDC,
  cusdc: MockCUSDC,
  poolAddress: string,
  who: HardhatEthersSigner,
  amount: bigint,
): Promise<void> {
  await (await usdc.mint(who.address, amount)).wait();
  await (await usdc.connect(who).approve(await cusdc.getAddress(), amount)).wait();
  await (await cusdc.connect(who).wrap(who.address, amount)).wait();
  // ERC-7984 uses operators, not ERC-20 approvals.
  await (await cusdc.connect(who).setOperator(poolAddress, OPERATOR_UNTIL)).wait();
}

async function deposit(pool: TenurePool, poolAddress: string, who: HardhatEthersSigner, amount: bigint): Promise<void> {
  const enc = await fhevm.createEncryptedInput(poolAddress, who.address).add64(amount).encrypt();
  await (await pool.connect(who).deposit(enc.handles[0], enc.inputProof)).wait();
}

/** Drive LADDER_BUILD to completion. */
async function buildLadder(pool: TenurePool): Promise<void> {
  while ((await pool.phase()) === Phase.LADDER_BUILD) {
    await (await pool.buildChunk()).wait();
  }
}

/** Decrypt the epoch total and submit it with a KMS proof, which also draws the winner. */
async function relayTotal(pool: TenurePool, kms: string): Promise<bigint> {
  const handle = await pool.encryptedTotal();
  const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
  const proof = await buildDecryptionProof(kms, [handle], [clear]);
  await (await pool.submitTotal(clear, proof)).wait();
  return clear;
}

/** Decrypt the winning number and submit it with a KMS proof, opening the claim window. */
async function relayWinner(pool: TenurePool, kms: string): Promise<bigint> {
  const handle = await pool.encryptedWinningNumber();
  const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
  const proof = await buildDecryptionProof(kms, [handle], [clear]);
  await (await pool.submitWinner(clear, proof)).wait();
  return clear;
}

describe("TenurePool full cycle", function () {
  beforeEach(function () {
    if (!fhevm.isMock) {
      console.warn("This suite only runs against the FHEVM mock environment");
      this.skip();
    }
  });

  it("runs fund -> deposit -> draw -> claim -> withdraw with exactly one winner", async function () {
    const { deployer, alice, bob, carol, usdc, cusdc, pool, reserve, poolAddress, KMSVerifierAddress } =
      await deployFixture();

    // --- fund epoch 0 -------------------------------------------------
    await (await usdc.mint(deployer.address, PRIZE)).wait();
    await (await usdc.approve(await reserve.getAddress(), PRIZE)).wait();
    await (await reserve.fundEpoch(0, PRIZE)).wait();

    expect(await pool.prizeAmount(0)).to.eq(PRIZE);
    expect(await pool.prizeFunded(0)).to.eq(true);

    // --- three depositors --------------------------------------------
    const stakes: Array<[HardhatEthersSigner, bigint]> = [
      [alice, 300_000n],
      [bob, 200_000n],
      [carol, 500_000n],
    ];
    for (const [who, amount] of stakes) {
      await fundAndEnable(usdc, cusdc, poolAddress, who, amount);
      await deposit(pool, poolAddress, who, amount);
    }
    expect(await pool.participantCount()).to.eq(3);

    // Deposits are deferred to the next epoch, which is what stops sniping.
    for (const [who] of stakes) {
      const info = await pool.accountInfo(who.address);
      expect(info.depositEpoch).to.eq(1);
    }

    // --- epoch 0 draws nobody: every weight is zero --------------------
    await (await pool.closeEpoch()).wait();
    await buildLadder(pool);
    expect(await pool.phase()).to.eq(Phase.TOTAL_PENDING);

    const zeroTotal = await relayTotal(pool, KMSVerifierAddress);
    expect(zeroTotal).to.eq(0n);
    // A zero total aborts to OPEN and rolls the prize forward, never dividing by zero.
    expect(await pool.phase()).to.eq(Phase.OPEN);
    expect(await pool.currentEpoch()).to.eq(1);
    expect(await pool.prizeAmount(1)).to.eq(PRIZE);

    // --- epoch 1 is the real draw -------------------------------------
    await (await pool.closeEpoch()).wait();
    await buildLadder(pool);

    const total = await relayTotal(pool, KMSVerifierAddress);
    expect(total).to.eq(1_000_000n); // 300k + 200k + 500k, all at tier 0 (1x)
    expect(await pool.phase()).to.eq(Phase.WINNER_PENDING);

    const winningNumber = await relayWinner(pool, KMSVerifierAddress);
    expect(winningNumber).to.be.lessThan(total);
    expect(await pool.phase()).to.eq(Phase.CLAIMABLE);

    // --- everyone claims; only one can be in range ---------------------
    const awards: bigint[] = [];
    for (const [who] of stakes) {
      await (await pool.connect(who).claimPrize(1)).wait();
      const handle = await pool.confidentialPendingPrizeOf(who.address);
      awards.push(await fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, who));
    }

    const winners = awards.filter((a) => a > 0n);
    expect(winners.length, `expected exactly one winner, got awards ${awards}`).to.eq(1);
    expect(winners[0]).to.eq(PRIZE);

    // The winner is whoever's range contains W. Confirm it matches the stakes ordering.
    const bounds = [0n, 300_000n, 500_000n, 1_000_000n];
    const expectedIndex = bounds.findIndex((_, i) => i > 0 && winningNumber < bounds[i]) - 1;
    expect(awards[expectedIndex]).to.eq(PRIZE);

    // --- winner moves the prize into principal, then everyone exits -----
    const winnerIdx = awards.findIndex((a) => a > 0n);
    const [winner, winnerStake] = stakes[winnerIdx];

    await (await pool.connect(winner).withdrawPrize()).wait();
    const balanceHandle = await pool.confidentialBalanceOf(winner.address);
    const winnerBalance = await fhevm.userDecryptEuint(FhevmType.euint64, balanceHandle, poolAddress, winner);
    expect(winnerBalance).to.eq(winnerStake + PRIZE);

    // Principal is withdrawable regardless of draw state.
    for (let i = 0; i < stakes.length; i++) {
      const [who, stake] = stakes[i];
      const target = i === winnerIdx ? stake + PRIZE : stake;
      const enc = await fhevm.createEncryptedInput(poolAddress, who.address).add64(target).encrypt();
      await (await pool.connect(who).withdraw(enc.handles[0], enc.inputProof)).wait();

      const after = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await pool.confidentialBalanceOf(who.address),
        poolAddress,
        who,
      );
      expect(after, `${who.address} should be fully withdrawn`).to.eq(0n);
    }
  });
});
