import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { MockUSDC, MockCUSDC, TenurePool, PrizeReserve } from "../types";
import { buildDecryptionProof } from "./helpers/decryption";

/**
 * Tenure weighting: the mechanism that makes sniping unprofitable.
 *
 * Odds scale with how long a balance has been held, and the published weighted total is the
 * observable consequence. With a single depositor the total *is* their weight, so driving epochs
 * forward and reading the total measures the multiplier directly.
 *
 * The all-zero configuration is asserted too. The design claims tenure weighting is a parameter
 * rather than a rule, and that `[0,0,0,0]` reduces Tenure to strict deposit-weighting — canonical
 * PoolTogether. That claim is only worth making if it is tested.
 */

const STAKE = 100_000n;
const PRIZE = 1_000_000n;
const WINDOW = 60; // the contract's MIN_WINDOW, for fast epochs

type Fixture = {
  deployer: HardhatEthersSigner;
  saver: HardhatEthersSigner;
  usdc: MockUSDC;
  cusdc: MockCUSDC;
  pool: TenurePool;
  reserve: PrizeReserve;
  poolAddress: string;
  kms: string;
};

async function deployFixture(tierShifts: [number, number, number, number]): Promise<Fixture> {
  const [deployer, saver] = await ethers.getSigners();

  const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
  await usdc.waitForDeployment();
  const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;
  await cusdc.waitForDeployment();

  const pool = (await (
    await ethers.getContractFactory("TenurePool")
  ).deploy(await cusdc.getAddress(), deployer.address, WINDOW, WINDOW, tierShifts)) as TenurePool;
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

  // Fund epoch 0 once. Nobody claims in these tests, so each finalize rolls the prize forward and
  // every later epoch is funded automatically.
  await (await usdc.mint(deployer.address, PRIZE)).wait();
  await (await usdc.approve(await reserve.getAddress(), PRIZE)).wait();
  await (await reserve.fundEpoch(0, PRIZE)).wait();

  return { deployer, saver, usdc, cusdc, pool, reserve, poolAddress, kms: KMSVerifierAddress };
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

/**
 * Drives one whole epoch and returns its published weighted total.
 *
 * A zero total aborts to OPEN by design, so there is no winner to publish and no claim window to
 * wait out.
 */
async function runEpoch(f: Fixture): Promise<bigint> {
  await (await f.pool.closeEpoch()).wait();
  while (Number(await f.pool.phase()) === 1) {
    await (await f.pool.buildChunk()).wait();
  }

  const totalHandle = await f.pool.encryptedTotal();
  const clearTotal = await fhevm.publicDecryptEuint(FhevmType.euint64, totalHandle);
  const totalProof = await buildDecryptionProof(f.kms, [totalHandle], [clearTotal]);
  await (await f.pool.submitTotal(clearTotal, totalProof)).wait();

  if (clearTotal === 0n) return 0n;

  const wHandle = await f.pool.encryptedWinningNumber();
  const clearW = await fhevm.publicDecryptEuint(FhevmType.euint64, wHandle);
  const wProof = await buildDecryptionProof(f.kms, [wHandle], [clearW]);
  await (await f.pool.submitWinner(clearW, wProof)).wait();

  await time.increase(WINDOW + 1);
  await (await f.pool.finalizeEpoch()).wait();

  return clearTotal;
}

describe("Tenure weighting", function () {
  beforeEach(function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  it("scales odds 1x, 2x, 4x, 4x, 8x as a balance is held", async function () {
    const f = await deployFixture([0, 1, 2, 3]);
    await deposit(f, f.saver, STAKE);

    // Epoch 0: the deposit is deferred, so nobody is eligible and the epoch rolls forward.
    expect(await runEpoch(f)).to.eq(0n);

    // Complete epochs held: 0, 1, 2, 3, 4 -> tiers 0, 1, 2, 2, 3.
    const observed: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      observed.push(await runEpoch(f));
    }

    expect(observed).to.deep.eq([
      STAKE, // 1x
      STAKE * 2n, // 2x
      STAKE * 4n, // 4x
      STAKE * 4n, // still 4x: tier 2 spans two epochs
      STAKE * 8n, // 8x
    ]);
  });

  it("reduces to strict deposit-weighting when every shift is zero", async function () {
    const f = await deployFixture([0, 0, 0, 0]);
    await deposit(f, f.saver, STAKE);

    expect(await runEpoch(f)).to.eq(0n);

    const observed: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      observed.push(await runEpoch(f));
    }

    // Identical every epoch: odds depend on balance alone, which is canonical PoolTogether.
    expect(observed).to.deep.eq([STAKE, STAKE, STAKE, STAKE, STAKE]);
  });

  it("resets tenure when more is deposited", async function () {
    const f = await deployFixture([0, 1, 2, 3]);
    await deposit(f, f.saver, STAKE);

    expect(await runEpoch(f)).to.eq(0n); // deposit deferred
    expect(await runEpoch(f)).to.eq(STAKE); // 1x
    expect(await runEpoch(f)).to.eq(STAKE * 2n); // 2x

    // Topping up restarts the clock. This is what closes "hold dust, then deposit large".
    await deposit(f, f.saver, STAKE);

    expect(await runEpoch(f)).to.eq(0n); // excluded from the epoch it landed in
    expect(await runEpoch(f)).to.eq(STAKE * 2n); // doubled balance, but back at 1x
  });

  it("resets tenure when funds are withdrawn", async function () {
    const f = await deployFixture([0, 1, 2, 3]);
    await deposit(f, f.saver, STAKE);

    await runEpoch(f); // deferred
    await runEpoch(f); // 1x
    expect(await runEpoch(f)).to.eq(STAKE * 2n); // 2x

    const enc = await fhevm
      .createEncryptedInput(f.poolAddress, f.saver.address)
      .add64(STAKE / 2n)
      .encrypt();
    await (await f.pool.connect(f.saver).withdraw(enc.handles[0], enc.inputProof)).wait();

    // The withdrawal epoch excludes the account, then it restarts at 1x on the reduced balance.
    expect(await runEpoch(f)).to.eq(0n);
    expect(await runEpoch(f)).to.eq(STAKE / 2n);
  });

  it("rejects tier shifts above the overflow headroom", async function () {
    const factory = await ethers.getContractFactory("TenurePool");
    const [deployer] = await ethers.getSigners();
    const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
    const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;

    await expect(
      factory.deploy(await cusdc.getAddress(), deployer.address, WINDOW, WINDOW, [0, 1, 2, 4]),
    ).to.be.revertedWithCustomError(factory, "InvalidTierShifts");
  });

  it("rejects tier shifts that fall as tenure grows", async function () {
    const factory = await ethers.getContractFactory("TenurePool");
    const [deployer] = await ethers.getSigners();
    const usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
    const cusdc = (await (await ethers.getContractFactory("MockCUSDC")).deploy(await usdc.getAddress())) as MockCUSDC;

    await expect(
      factory.deploy(await cusdc.getAddress(), deployer.address, WINDOW, WINDOW, [0, 2, 1, 3]),
    ).to.be.revertedWithCustomError(factory, "InvalidTierShifts");
  });
});
