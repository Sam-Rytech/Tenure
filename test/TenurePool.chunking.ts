import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { MockUSDC, MockCUSDC, TenurePool, PrizeReserve } from "../types";
import { buildDecryptionProof } from "./helpers/decryption";

/**
 * The ladder chunk boundary.
 *
 * `buildChunk` processes at most `LADDER_CHUNK` participants per transaction because the
 * cumulative sum is depth-bound: 20 sequential `FHE.add`s sit at 3,240,000 HCU against a
 * 5,000,000 ceiling. Splitting the build across transactions is what makes the pool
 * unbounded in participants, and it is also the part most likely to be quietly wrong.
 *
 * Three risks are tested at 19, 20 and 21 participants:
 *
 *   1. Off-by-one in the cursor, so the last participant is skipped or processed twice.
 *   2. The phase advancing early or never, since it only advances when the cursor reaches the
 *      snapshot.
 *   3. The running total failing to carry across a transaction boundary, which would silently
 *      corrupt every range after the first chunk.
 *
 * The third is checked structurally: `end` of rung i and `start` of rung i+1 are the same
 * ciphertext handle, so a broken carry shows up as a mismatch exactly at index 19/20.
 */

const STAKE = 1_000n;
const PRIZE = 1_000_000n;
const WINDOW = 60;
const LADDER_CHUNK = 20;

type Fixture = {
  usdc: MockUSDC;
  cusdc: MockCUSDC;
  pool: TenurePool;
  reserve: PrizeReserve;
  poolAddress: string;
  kms: string;
};

async function deployFixture(): Promise<Fixture> {
  const [deployer] = await ethers.getSigners();

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

  await (await usdc.mint(deployer.address, PRIZE)).wait();
  await (await usdc.approve(await reserve.getAddress(), PRIZE)).wait();
  await (await reserve.fundEpoch(0, PRIZE)).wait();

  const poolAddress = await pool.getAddress();
  const { KMSVerifierAddress } = await fhevm.getCoprocessorConfig(poolAddress);
  return { usdc, cusdc, pool, reserve, poolAddress, kms: KMSVerifierAddress };
}

async function deposit(f: Fixture, who: HardhatEthersSigner, amount: bigint) {
  await (await f.usdc.mint(who.address, amount)).wait();
  await (await f.usdc.connect(who).approve(await f.cusdc.getAddress(), amount)).wait();
  await (await f.cusdc.connect(who).wrap(who.address, amount)).wait();
  await (await f.cusdc.connect(who).setOperator(f.poolAddress, 2_000_000_000)).wait();
  const enc = await fhevm.createEncryptedInput(f.poolAddress, who.address).add64(amount).encrypt();
  await (await f.pool.connect(who).deposit(enc.handles[0], enc.inputProof)).wait();
}

/** Runs an epoch to completion, counting how many chunk transactions the ladder needed. */
async function runEpoch(f: Fixture): Promise<{ total: bigint; chunks: number }> {
  await (await f.pool.closeEpoch()).wait();

  let chunks = 0;
  while (Number(await f.pool.phase()) === 1) {
    await (await f.pool.buildChunk()).wait();
    chunks++;
    expect(chunks, "ladder build did not terminate").to.be.lessThan(10);
  }

  const handle = await f.pool.encryptedTotal();
  const total = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
  await (await f.pool.submitTotal(total, await buildDecryptionProof(f.kms, [handle], [total]))).wait();
  return { total, chunks };
}

describe("Ladder chunk boundary", function () {
  beforeEach(function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  for (const count of [LADDER_CHUNK - 1, LADDER_CHUNK, LADDER_CHUNK + 1]) {
    it(`builds a correct ladder for ${count} participants`, async function () {
      const f = await deployFixture();
      const signers = (await ethers.getSigners()).slice(1, 1 + count);
      expect(signers.length, "not enough funded test accounts").to.eq(count);

      for (const who of signers) {
        await deposit(f, who, STAKE);
      }
      expect(await f.pool.participantCount()).to.eq(count);

      // Epoch 0 defers every deposit, so the ladder is built but every weight is zero. That still
      // exercises the cursor across the same number of chunks.
      const first = await runEpoch(f);
      expect(first.total, "deferred deposits carry no weight").to.eq(0n);
      expect(first.chunks, "chunk count").to.eq(Math.ceil(count / LADDER_CHUNK));

      // Epoch 1: everyone is eligible, so the total must be the exact sum of stakes at tier 0.
      const second = await runEpoch(f);
      expect(second.total, "every participant counted exactly once").to.eq(STAKE * BigInt(count));
      expect(second.chunks).to.eq(Math.ceil(count / LADDER_CHUNK));
    });
  }

  it("carries the running total across a chunk boundary", async function () {
    const f = await deployFixture();
    const count = LADDER_CHUNK + 1;
    const signers = (await ethers.getSigners()).slice(1, 1 + count);

    for (const who of signers) {
      await deposit(f, who, STAKE);
    }

    await runEpoch(f); // epoch 0, deferred
    const { total, chunks } = await runEpoch(f); // epoch 1, the real ladder
    expect(chunks).to.eq(2);
    expect(total).to.eq(STAKE * BigInt(count));

    // Ranges are half-open and contiguous, so each rung's end is literally the next rung's start.
    // Checking across index 19/20 proves the running total survived the transaction boundary.
    const epoch = 1;
    for (let i = 0; i < count - 1; i++) {
      const [, end] = await f.pool.rungOf(epoch, i);
      const [nextStart] = await f.pool.rungOf(epoch, i + 1);
      expect(nextStart, `rung ${i} end should equal rung ${i + 1} start`).to.eq(end);
    }

    // The ladder must end exactly at the published total: the last rung's end is the very handle
    // that was made publicly decryptable, so no weight is lost or double-counted in the final
    // chunk. The first rung's start is not asserted here because it was never made publicly
    // decryptable, and a check that can only be skipped is worse than no check.
    const [, lastEnd] = await f.pool.rungOf(epoch, count - 1);
    expect(lastEnd, "last rung ends at the published total").to.eq(await f.pool.encryptedTotal());
  });
});
