import { ethers, fhevm, deployments } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ContractTransactionResponse } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Runs one complete Tenure cycle on a live network and records every transaction hash.
 *
 *   npx hardhat run scripts/live-cycle.ts --network sepolia
 *
 * This doubles as the reference keeper implementation. Decryption is self-relaying: the script
 * fetches each cleartext and its KMS proof from the relayer via the SDK, then submits both
 * on-chain for `FHE.checkSignatures` to verify. No oracle callback is involved, because
 * `FHE.requestDecryption` was removed in protocol v0.9.
 *
 * Progress is written to deployments/<network>/live-cycle.json after every step, so a failure
 * part way through does not lose the record of what already happened.
 */

/**
 * The Zama relayer is often slow to accept a connection. undici (which backs global fetch) gives
 * up after 10 seconds by default and throws ConnectTimeoutError from a timer callback, which
 * escapes any surrounding try/catch and terminates the process mid-cycle. Raising the timeouts
 * addresses the cause; the retry wrapper below then handles genuine transient failures.
 */
function relaxHttpTimeouts(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici");
    undici.setGlobalDispatcher(
      new undici.Agent({
        connect: { timeout: 120_000 },
        headersTimeout: 120_000,
        bodyTimeout: 120_000,
      }),
    );
    console.log("  [http] relayer timeouts raised to 120s");
  } catch (e) {
    // Without this the default 10s connect timeout throws from a timer callback, which escapes
    // any surrounding try/catch and kills the run mid-cycle.
    console.warn(`  [http] WARNING: could not raise timeouts: ${(e as Error).message}`);
  }
}

relaxHttpTimeouts();

const UNDERLYING = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const OPERATOR_UNTIL = 2_000_000_000;
const PRIZE = 1_000_000n; // 1 cUSDC at 6 decimals
const STAKES = [300_000n, 200_000n, 500_000n];

/** Participants to run with. Fewer costs less gas, which matters on a funded testnet account. */
const PLAYER_COUNT = Math.min(Number(process.env.PLAYERS ?? 3), STAKES.length);

const PHASE_NAMES = ["OPEN", "LADDER_BUILD", "TOTAL_PENDING", "WINNER_PENDING", "CLAIMABLE"];

type Tx = Promise<ContractTransactionResponse>;

/** Minimal typed views of the two external contracts we drive. */
interface UnderlyingLike {
  connect(signer: HardhatEthersSigner): UnderlyingLike;
  mint(to: string, amount: bigint): Tx;
  approve(spender: string, amount: bigint): Tx;
}

interface CusdcLike {
  connect(signer: HardhatEthersSigner): CusdcLike;
  wrap(to: string, amount: bigint): Tx;
  setOperator(operator: string, until: number): Tx;
  isOperator(holder: string, spender: string): Promise<boolean>;
}

/**
 * What a public decryption returns. The live relayer names the map `clearValues`, while the
 * Hardhat mock names it `values`, so the keeper accepts either.
 */
interface PublicDecryptResult {
  clearValues?: Record<string, string | bigint | boolean>;
  values?: Record<string, string | bigint | boolean>;
  abiEncodedClearValues?: string;
  decryptionProof: string;
}

interface Step {
  step: string;
  hash?: string;
  note?: string;
}

const steps: Step[] = [];
let outFile = "";

/** Load any record from a previous run so a resumed cycle keeps its earlier transaction hashes. */
function loadPrevious(file: string): void {
  if (!fs.existsSync(file)) return;
  try {
    const prior = JSON.parse(fs.readFileSync(file, "utf-8")) as Step[];
    if (Array.isArray(prior)) steps.push(...prior);
  } catch {
    // A corrupt record should not stop the cycle; it is a log, not state.
  }
}

function record(step: string, hash?: string, note?: string): void {
  steps.push({ step, hash, note });
  console.log(`  ${step.padEnd(32)} ${hash ?? note ?? ""}`);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(steps, null, 2));
}

/**
 * Retries a relayer call. The Zama relayer intermittently drops connections
 * (undici UND_ERR_CONNECT_TIMEOUT), which would otherwise abort a cycle part way through. This is
 * the same tolerance a production keeper needs, and it is why every waiting phase on-chain also
 * has an `abortDraw` timeout.
 */
/** First line of an error message, for compact retry logging. */
function firstLine(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.split(String.fromCharCode(10))[0].slice(0, 80);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.log(`    retry ${i}/${attempts} for ${label}: ${firstLine(e)}`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
  throw lastError;
}

async function send(step: string, txPromise: Tx): Promise<void> {
  const tx = await txPromise;
  await tx.wait();
  record(step, tx.hash);
}

/** Fetch a cleartext and its KMS proof from the relayer, then submit both on-chain. */
async function relay(label: string, handle: string, submit: (clear: bigint, proof: string) => Tx): Promise<bigint> {
  const results = (await withRetry(label, () => fhevm.publicDecrypt([handle]))) as unknown as PublicDecryptResult;
  const map = results.clearValues ?? results.values;
  if (map === undefined) {
    throw new Error(`relayer response had neither clearValues nor values for ${label}`);
  }

  // Key formatting can differ between relayer and mock; with a single handle the lone entry is
  // unambiguous, so fall back to it rather than failing on a cosmetic key mismatch.
  let raw = map[handle];
  if (raw === undefined) {
    const entries = Object.entries(map);
    if (entries.length !== 1) {
      throw new Error(`relayer returned no value for handle ${handle}`);
    }
    raw = entries[0][1];
  }
  if (typeof results.decryptionProof !== "string" || results.decryptionProof.length < 4) {
    throw new Error(`relayer returned no usable decryptionProof for ${label}`);
  }
  const clear = BigInt(raw as string | bigint);
  record(`${label} decrypted`, undefined, `value=${clear}`);
  await send(label, submit(clear, results.decryptionProof));
  return clear;
}

async function main(): Promise<void> {
  // `hardhat run` does not bootstrap the FHEVM plugin the way `hardhat test` does, so the
  // relayer client must be initialised explicitly before any encrypt or decrypt call.
  await fhevm.initializeCLIApi();

  const net = await ethers.provider.getNetwork();
  const networkDir = net.chainId === 11155111n ? "sepolia" : "localhost";
  console.log(`Network: ${net.name} (chainId ${net.chainId})\n`);

  // Recorded under docs/ rather than deployments/, which is gitignored: the cycle log is a
  // deliverable the README links to, while the deployment artefacts are bytecode Etherscan
  // already holds.
  const recordDir = path.join(__dirname, "..", "docs");
  fs.mkdirSync(recordDir, { recursive: true });
  outFile = path.join(recordDir, `cycle-${networkDir}.json`);
  loadPrevious(outFile);

  /*
   * Decryption permits carry a validity window, and the relayer rejects one whose start is in
   * its own future with `validation_failed: requestValidity`. Left to default, the window is
   * anchored to this machine's clock, so even a few seconds of skew makes every user decryption
   * fail. Anchoring to chain time with a margin behind it removes the dependency on local time.
   */
  const latestBlock = await ethers.provider.getBlock("latest");
  const validity = {
    startTimestamp: (latestBlock?.timestamp ?? Math.floor(Date.now() / 1000)) - 300,
    durationDays: 1,
  };
  record("decrypt permit window", undefined, `starts ${validity.startTimestamp}, 1 day`);

  const poolDeployment = await deployments.get("TenurePool");
  const reserveDeployment = await deployments.get("PrizeReserve");

  const allSigners = await ethers.getSigners();
  const players = allSigners.slice(0, PLAYER_COUNT);
  const deployer = players[0];

  // Helper accounts come from the same mnemonic but hold no ETH, so top them up for gas.
  if (PLAYER_COUNT > 1) {
    const needed = ethers.parseEther(process.env.GAS_TOPUP ?? "0.008");
    for (let i = 1; i < players.length; i++) {
      const bal = await ethers.provider.getBalance(players[i].address);
      if (bal < needed / 2n) {
        const tx = await deployer.sendTransaction({ to: players[i].address, value: needed });
        await tx.wait();
        record(`fund p${i + 1} gas`, tx.hash, ethers.formatEther(needed) + " ETH");
      }
    }
  }

  const pool = await ethers.getContractAt("TenurePool", poolDeployment.address);
  const reserve = await ethers.getContractAt("PrizeReserve", reserveDeployment.address);
  const cusdcAddress: string = await pool.TOKEN();

  const underlying = new ethers.Contract(
    UNDERLYING,
    ["function mint(address,uint256)", "function approve(address,uint256) returns (bool)"],
    ethers.provider,
  ) as unknown as UnderlyingLike;

  const cusdc = new ethers.Contract(
    cusdcAddress,
    [
      "function wrap(address,uint256) returns (bytes32)",
      "function setOperator(address,uint48)",
      "function isOperator(address,address) view returns (bool)",
    ],
    ethers.provider,
  ) as unknown as CusdcLike;

  console.log(`TenurePool   ${poolDeployment.address}`);
  console.log(`PrizeReserve ${reserveDeployment.address}`);
  console.log(`cUSDC        ${cusdcAddress}\n`);

  /*
   * Fund an epoch immediately before closing it, never once at startup.
   *
   * Finalizing an epoch advances the counter, so a prize funded for whichever epoch was current
   * when the script began belongs to an epoch that has already closed by the time the next one
   * needs it, and closeEpoch reverts with PrizeNotFunded.
   */
  async function ensureFunded(epoch: number): Promise<void> {
    if (await pool.prizeFunded(epoch)) {
      record("prize already funded", undefined, `epoch ${epoch}`);
      return;
    }
    await send(`mint underlying (epoch ${epoch})`, underlying.connect(deployer).mint(deployer.address, PRIZE));
    await send("approve reserve", underlying.connect(deployer).approve(reserveDeployment.address, PRIZE));
    await send(`fundEpoch(${epoch})`, reserve.connect(deployer).fundEpoch(epoch, PRIZE) as Tx);
  }

  // --- 2. participants deposit -------------------------------------------
  console.log("\nParticipants:");
  for (let i = 0; i < players.length; i++) {
    const who = players[i];
    const amount = STAKES[i];
    const label = `p${i + 1}`;

    if ((await pool.accountInfo(who.address)).enrolled) {
      record(`${label} already enrolled`, undefined, who.address);
      continue;
    }

    await send(`${label} mint`, underlying.connect(who).mint(who.address, amount));
    await send(`${label} approve wrapper`, underlying.connect(who).approve(cusdcAddress, amount));
    await send(`${label} wrap`, cusdc.connect(who).wrap(who.address, amount));

    if (!(await cusdc.isOperator(who.address, poolDeployment.address))) {
      await send(`${label} setOperator`, cusdc.connect(who).setOperator(poolDeployment.address, OPERATOR_UNTIL));
    }

    const enc = await withRetry(`${label} encrypt`, () =>
      fhevm.createEncryptedInput(poolDeployment.address, who.address).add64(amount).encrypt(),
    );
    await send(`${label} deposit`, pool.connect(who).deposit(enc.handles[0], enc.inputProof) as Tx);
  }

  // --- 3. drive the draw machine -----------------------------------------
  // Deposits are deferred by one epoch, so the first close draws nobody and rolls forward.
  for (let round = 0; round < 3; round++) {
    let epoch = Number(await pool.currentEpoch());
    console.log(`\nEpoch ${epoch} (phase ${PHASE_NAMES[Number(await pool.phase())]}):`);

    // A finished epoch sits in CLAIMABLE until its claim window expires; finalize to reopen.
    if (Number(await pool.phase()) === 4) {
      const deadline = Number(await pool.epochClaimDeadline(epoch));
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      if (now < deadline) {
        record("claim window still open", undefined, `${deadline - now}s remaining on epoch ${epoch}`);
        break;
      }
      await send(`finalizeEpoch(${epoch})`, pool.connect(deployer).finalizeEpoch() as Tx);
      epoch = Number(await pool.currentEpoch());
    }

    if (Number(await pool.phase()) === 0) {
      await ensureFunded(epoch);
      await send(`closeEpoch(${epoch})`, pool.connect(deployer).closeEpoch() as Tx);
    }

    while (Number(await pool.phase()) === 1) {
      await send(`buildChunk(${epoch})`, pool.connect(deployer).buildChunk() as Tx);
    }

    if (Number(await pool.phase()) === 2) {
      const total = await relay(
        `submitTotal(${epoch})`,
        await pool.encryptedTotal(),
        (clear, proof) => pool.connect(deployer).submitTotal(clear, proof) as Tx,
      );
      if (total === 0n) {
        record("zero total, rolled forward", undefined, "no eligible participants this epoch");
        continue;
      }
    }

    if (Number(await pool.phase()) === 3) {
      await relay(
        `submitWinner(${epoch})`,
        await pool.encryptedWinningNumber(),
        (clear, proof) => pool.connect(deployer).submitWinner(clear, proof) as Tx,
      );
      break;
    }
  }

  const drawEpoch = Number(await pool.currentEpoch());
  record("published total", undefined, (await pool.epochTotalTickets(drawEpoch)).toString());
  record("published winning number", undefined, (await pool.epochWinningNumber(drawEpoch)).toString());

  // --- 4. everyone claims -------------------------------------------------
  console.log("\nClaims:");
  const awards: bigint[] = [];
  for (let i = 0; i < players.length; i++) {
    const who = players[i];
    const label = `p${i + 1}`;
    if (!(await pool.hasClaimed(drawEpoch, who.address))) {
      await send(`${label} claimPrize`, pool.connect(who).claimPrize(drawEpoch) as Tx);
    }
    const handle = await pool.confidentialPendingPrizeOf(who.address);
    const award = await withRetry(`${label} userDecrypt`, () =>
      fhevm.userDecryptEuint(FhevmType.euint64, handle, poolDeployment.address, who, { validity }),
    );
    awards.push(award);
    record(`${label} pendingPrize`, undefined, award.toString());
  }

  const winnerIdx = awards.findIndex((a) => a > 0n);
  if (winnerIdx < 0) {
    record("NO WINNER", undefined, "unexpected: W should land in exactly one range");
    return;
  }
  record("winner", undefined, `p${winnerIdx + 1} ${players[winnerIdx].address}`);

  // --- 5. winner banks the prize -----------------------------------------
  console.log("\nSettlement:");
  const winner = players[winnerIdx];
  await send("winner withdrawPrize", pool.connect(winner).withdrawPrize() as Tx);

  const winnerBalanceHandle = await pool.confidentialBalanceOf(winner.address);
  const balance = await withRetry("winner balance", () =>
    fhevm.userDecryptEuint(FhevmType.euint64, winnerBalanceHandle, poolDeployment.address, winner, { validity }),
  );
  record("winner balance", undefined, `${balance} (stake ${STAKES[winnerIdx]} + prize ${PRIZE})`);

  console.log(`\nRecorded ${steps.length} steps to ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(steps, null, 2));
  process.exitCode = 1;
});
