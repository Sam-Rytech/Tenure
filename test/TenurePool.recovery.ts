import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { MockUSDC, MockCUSDC, TenurePool, PrizeReserve } from "../types";
import { buildDecryptionProof } from "./helpers/decryption";

/**
 * Recovery paths and guards.
 *
 * Season 3 entrants were publicly challenged for leaving funds stuck with no way out, so every
 * phase that can stall has an escape and every escape is exercised here. The invariant these
 * tests defend: no user action, decryption failure or draw phase can make principal
 * unrecoverable.
 */

const STAKE = 100_000n;
const PRIZE = 1_000_000n;
const WINDOW = 60;

const Phase = { OPEN: 0, LADDER_BUILD: 1, TOTAL_PENDING: 2, WINNER_PENDING: 3, CLAIMABLE: 4 };

type Fixture = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  usdc: MockUSDC;
  cusdc: MockCUSDC;
  pool: TenurePool;
  reserve: PrizeReserve;
  poolAddress: string;
  kms: string;
};

async function deployFixture(fund = true): Promise<Fixture> {
  const [deployer, alice, bob] = await ethers.getSigners();

  const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
  const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;
  const pool = (await (
    await ethers.getContractFactory("TenurePool")
  ).deploy(await cusdc.getAddress(), deployer.address, WINDOW, WINDOW, [0, 1, 2, 3])) as TenurePool;
  const reserve = (await (
    await ethers.getContractFactory("PrizeReserve")
  ).deploy(
    await usdc.getAddress(),
    await cusdc.getAddress(),
    await pool.getAddress(),
    deployer.address,
  )) as PrizeReserve;
  await (await pool.setReserve(await reserve.getAddress())).wait();

  const poolAddress = await pool.getAddress();
  const { KMSVerifierAddress } = await fhevm.getCoprocessorConfig(poolAddress);

  if (fund) {
    await (await usdc.mint(deployer.address, PRIZE)).wait();
    await (await usdc.approve(await reserve.getAddress(), PRIZE)).wait();
    await (await reserve.fundEpoch(0, PRIZE)).wait();
  }

  return { deployer, alice, bob, usdc, cusdc, pool, reserve, poolAddress, kms: KMSVerifierAddress };
}

async function deposit(f: Fixture, who: HardhatEthersSigner, amount: bigint) {
  await (await f.usdc.mint(who.address, amount)).wait();
  await (await f.usdc.connect(who).approve(await f.cusdc.getAddress(), amount)).wait();
  await (await f.cusdc.connect(who).wrap(who.address, amount)).wait();
  if (!(await f.cusdc.isOperator(who.address, f.poolAddress))) {
    await (await f.cusdc.connect(who).setOperator(f.poolAddress, 2_000_000_000)).wait();
  }
  const enc = await fhevm.createEncryptedInput(f.poolAddress, who.address).add64(amount).encrypt();
  await (await f.pool.connect(who).deposit(enc.handles[0], enc.inputProof)).wait();
}

async function submitTotal(f: Fixture): Promise<bigint> {
  const handle = await f.pool.encryptedTotal();
  const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
  await (await f.pool.submitTotal(clear, await buildDecryptionProof(f.kms, [handle], [clear]))).wait();
  return clear;
}

async function submitWinner(f: Fixture): Promise<bigint> {
  const handle = await f.pool.encryptedWinningNumber();
  const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
  await (await f.pool.submitWinner(clear, await buildDecryptionProof(f.kms, [handle], [clear]))).wait();
  return clear;
}

async function buildLadder(f: Fixture) {
  while (Number(await f.pool.phase()) === Phase.LADDER_BUILD) {
    await (await f.pool.buildChunk()).wait();
  }
}

/** Advances to a live draw with two eligible participants. */
async function reachClaimable(f: Fixture) {
  await deposit(f, f.alice, STAKE);
  await deposit(f, f.bob, STAKE * 2n);

  await (await f.pool.closeEpoch()).wait(); // epoch 0: everyone deferred
  await buildLadder(f);
  await submitTotal(f); // zero total, rolls forward

  await (await f.pool.closeEpoch()).wait(); // epoch 1: the real draw
  await buildLadder(f);
  await submitTotal(f);
  await submitWinner(f);
}

describe("Recovery paths and guards", function () {
  beforeEach(function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  it("refuses to close an epoch with no funded prize", async function () {
    const f = await deployFixture(false);
    await deposit(f, f.alice, STAKE);

    // The guard that makes "winner paid an encrypted zero from an empty pool" unreachable.
    await expect(f.pool.closeEpoch()).to.be.revertedWithCustomError(f.pool, "PrizeNotFunded");
  });

  it("aborts a stalled ladder build once the timeout elapses", async function () {
    const f = await deployFixture();
    await deposit(f, f.alice, STAKE);
    await (await f.pool.closeEpoch()).wait();
    expect(Number(await f.pool.phase())).to.eq(Phase.LADDER_BUILD);

    await expect(f.pool.abortDraw()).to.be.revertedWithCustomError(f.pool, "TimeoutNotReached");

    await time.increase(WINDOW + 1);
    await (await f.pool.abortDraw()).wait();

    expect(Number(await f.pool.phase())).to.eq(Phase.OPEN);
    expect(await f.pool.currentEpoch()).to.eq(1);
    // The prize is not stranded: it moves to the epoch that follows.
    expect(await f.pool.prizeAmount(1)).to.eq(PRIZE);
  });

  it("aborts when nobody submits the decrypted total", async function () {
    const f = await deployFixture();
    await deposit(f, f.alice, STAKE);
    await (await f.pool.closeEpoch()).wait();
    await buildLadder(f);
    expect(Number(await f.pool.phase())).to.eq(Phase.TOTAL_PENDING);

    await time.increase(WINDOW + 1);
    await (await f.pool.abortDraw()).wait();
    expect(Number(await f.pool.phase())).to.eq(Phase.OPEN);
  });

  it("aborts when nobody submits the winning number", async function () {
    const f = await deployFixture();
    await reachClaimable(f);
    // reachClaimable ends in CLAIMABLE, so rebuild the stall on the next epoch instead.
    await time.increase(WINDOW + 1);
    await (await f.pool.finalizeEpoch()).wait();

    await (await f.pool.closeEpoch()).wait();
    await buildLadder(f);
    await submitTotal(f);
    expect(Number(await f.pool.phase())).to.eq(Phase.WINNER_PENDING);

    await time.increase(WINDOW + 1);
    await (await f.pool.abortDraw()).wait();
    expect(Number(await f.pool.phase())).to.eq(Phase.OPEN);
  });

  it("rejects a second claim for the same epoch", async function () {
    const f = await deployFixture();
    await reachClaimable(f);
    const epoch = Number(await f.pool.currentEpoch());

    await (await f.pool.connect(f.alice).claimPrize(epoch)).wait();
    await expect(f.pool.connect(f.alice).claimPrize(epoch)).to.be.revertedWithCustomError(f.pool, "AlreadyClaimed");
  });

  it("rejects a claim after the window closes", async function () {
    const f = await deployFixture();
    await reachClaimable(f);
    const epoch = Number(await f.pool.currentEpoch());

    await time.increase(WINDOW + 1);
    await expect(f.pool.connect(f.alice).claimPrize(epoch)).to.be.revertedWithCustomError(f.pool, "ClaimWindowClosed");
  });

  it("rejects a claim from an address that never deposited", async function () {
    const f = await deployFixture();
    await reachClaimable(f);
    const epoch = Number(await f.pool.currentEpoch());
    const stranger = (await ethers.getSigners())[5];

    await expect(f.pool.connect(stranger).claimPrize(epoch)).to.be.revertedWithCustomError(f.pool, "NotEnrolled");
  });

  it("refuses to finalize while the claim window is open", async function () {
    const f = await deployFixture();
    await reachClaimable(f);

    await expect(f.pool.finalizeEpoch()).to.be.revertedWithCustomError(f.pool, "ClaimWindowOpen");
  });

  it("lets principal out in every draw phase", async function () {
    const f = await deployFixture();
    await deposit(f, f.alice, STAKE);

    // OPEN
    await withdrawAll(f, f.alice, STAKE / 4n);

    await (await f.pool.closeEpoch()).wait();
    // LADDER_BUILD
    await withdrawAll(f, f.alice, STAKE / 4n);

    await buildLadder(f);
    // TOTAL_PENDING
    await withdrawAll(f, f.alice, STAKE / 4n);

    await submitTotal(f); // zero total -> back to OPEN, next epoch
    await (await f.pool.closeEpoch()).wait();
    await buildLadder(f);
    await submitTotal(f);
    await submitWinner(f);
    // CLAIMABLE
    await withdrawAll(f, f.alice, STAKE / 4n);

    const balance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await f.pool.confidentialBalanceOf(f.alice.address),
      f.poolAddress,
      f.alice,
    );
    expect(balance, "principal is never locked by draw machinery").to.eq(0n);
  });

  async function withdrawAll(f: Fixture, who: HardhatEthersSigner, amount: bigint) {
    const enc = await fhevm.createEncryptedInput(f.poolAddress, who.address).add64(amount).encrypt();
    await (await f.pool.connect(who).withdraw(enc.handles[0], enc.inputProof)).wait();
  }

  it("moves nothing when a deposit would breach the per-account cap", async function () {
    const f = await deployFixture();
    const cap = await f.pool.MAX_ACCOUNT_BALANCE();
    const tooMuch = cap + 1n;

    await (await f.usdc.mint(f.alice.address, tooMuch)).wait();
    await (await f.usdc.connect(f.alice).approve(await f.cusdc.getAddress(), tooMuch)).wait();
    await (await f.cusdc.connect(f.alice).wrap(f.alice.address, tooMuch)).wait();
    await (await f.cusdc.connect(f.alice).setOperator(f.poolAddress, 2_000_000_000)).wait();

    const enc = await fhevm.createEncryptedInput(f.poolAddress, f.alice.address).add64(tooMuch).encrypt();
    await (await f.pool.connect(f.alice).deposit(enc.handles[0], enc.inputProof)).wait();

    // The cap is enforced before funds move, so the user keeps their tokens rather than having
    // them stranded in the pool.
    const balance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await f.pool.confidentialBalanceOf(f.alice.address),
      f.poolAddress,
      f.alice,
    );
    expect(balance).to.eq(0n);
  });

  it("only lets the configured reserve record a funded prize", async function () {
    const f = await deployFixture();
    await expect(f.pool.connect(f.alice).notifyPrizeFunded(0, PRIZE)).to.be.revertedWithCustomError(
      f.pool,
      "NotReserve",
    );
  });

  it("wires the reserve exactly once", async function () {
    const f = await deployFixture();
    await expect(f.pool.setReserve(f.alice.address)).to.be.revertedWithCustomError(f.pool, "ReserveAlreadySet");
  });
});
