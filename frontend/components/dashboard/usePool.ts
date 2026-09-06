"use client";

import { useMemo, useState } from "react";
import { parseAbi } from "viem";
import {
  useAccount,
  useChainId,
  useConfig,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import {
  useConfidentialIsOperator,
  useConfidentialSetOperator,
  useDecryptValues,
  useEncrypt,
  useGrantPermit,
  useHasPermit,
} from "@zama-fhe/react-sdk";
import { isEncryptedValueZero } from "@zama-fhe/sdk";
/*
 * The input type is named from the package root on purpose.
 *
 * `useDecryptValues` is declared as taking `EncryptedInput[]`, but the react package's own types
 * import that name from "@zama-fhe/sdk/query/user-decrypt", which is not an exported subpath of
 * that package. The import fails, `skipLibCheck` swallows it, and the parameter silently becomes
 * `any` — which is how a wrong property name once passed a clean build and crashed the page on
 * connect. The same shape is exported from the root as `DecryptInput`, which does resolve.
 */
import type { DecryptInput } from "@zama-fhe/sdk";

import { TENURE_POOL_ABI, ERC20_ABI, CUSDC_ABI } from "@/lib/abi";
import { ADDRESSES, SEPOLIA_CHAIN_ID, parseUnits6 } from "@/lib/config";

const erc20Abi = parseAbi(ERC20_ABI);
const cusdcAbi = parseAbi(CUSDC_ABI);

const OPERATOR_UNTIL = 2_000_000_000;
const FAUCET_AMOUNT = 5_000_000n; // 5 cUSDC

/**
 * Everything the dashboard knows about your position, in one place.
 *
 * The pages are separate routes but they read the same account, so the reads live here rather
 * than in whichever page happens to be first. React Query dedupes them, so a tab switch does not
 * refetch what another tab already has.
 */
export function usePool() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [error, setError] = useState<unknown>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  /** What a multi-step action is currently doing, so a long wait is legible rather than a spinner. */
  const [step, setStep] = useState<string | null>(null);
  const config = useConfig();

  const onWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  const { writeContractAsync, isPending: writing } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: lastTx ?? undefined });
  const busy = writing || confirming;

  const enabled = { enabled: Boolean(address) };

  const { data: accountInfo, refetch: refetchAccount } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "accountInfo",
    args: address ? [address] : undefined,
    query: enabled,
  });

  const { data: balanceHandle } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: enabled,
  });

  const { data: prizeHandle } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "confidentialPendingPrizeOf",
    args: address ? [address] : undefined,
    query: enabled,
  });

  const { data: currentEpoch } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "currentEpoch",
  });

  // --- decryption ---------------------------------------------------------
  const { data: hasPermit } = useHasPermit({ contractAddresses: [ADDRESSES.pool] });
  const { mutateAsync: grantPermit, isPending: granting } = useGrantPermit();

  /*
   * An account that has never held a position has no ciphertext, and the pool returns a zero
   * handle for it. That is a perfectly truthy string, so it used to be handed to the relayer,
   * which has nothing to decrypt — and it is not a secret in any case: a zero handle means zero.
   */
  const balanceIsZero = typeof balanceHandle === "string" && isEncryptedValueZero(balanceHandle);
  const prizeIsZero = typeof prizeHandle === "string" && isEncryptedValueZero(prizeHandle);

  const decryptInputs = useMemo<DecryptInput[]>(() => {
    const inputs: DecryptInput[] = [];
    if (typeof balanceHandle === "string" && !isEncryptedValueZero(balanceHandle)) {
      inputs.push({ encryptedValue: balanceHandle as `0x${string}`, contractAddress: ADDRESSES.pool });
    }
    if (typeof prizeHandle === "string" && !isEncryptedValueZero(prizeHandle)) {
      inputs.push({ encryptedValue: prizeHandle as `0x${string}`, contractAddress: ADDRESSES.pool });
    }
    return inputs;
  }, [balanceHandle, prizeHandle]);

  const {
    data: cleartexts,
    refetch: reveal,
    isFetching: revealing,
  } = useDecryptValues(decryptInputs, { enabled: false });

  const clearBalance = balanceIsZero ? 0n : balanceHandle ? cleartexts?.[balanceHandle as `0x${string}`] : undefined;
  const clearPrize = prizeIsZero ? 0n : prizeHandle ? cleartexts?.[prizeHandle as `0x${string}`] : undefined;

  // --- operator -----------------------------------------------------------
  const { data: isOperator, refetch: refetchOperator } = useConfidentialIsOperator({
    address: ADDRESSES.cusdc,
    holder: address,
    spender: ADDRESSES.pool,
  });
  const { mutateAsync: setOperator, isPending: settingOperator } = useConfidentialSetOperator(ADDRESSES.cusdc);

  const encrypt = useEncrypt();

  async function run(fn: () => Promise<`0x${string}` | void>) {
    setError(null);
    try {
      const hash = await fn();
      if (hash) setLastTx(hash);
      await Promise.all([refetchAccount(), refetchOperator()]);
    } catch (e) {
      setError(e);
    }
  }

  /**
   * Mint the public test token, approve the wrapper, then wrap it into cUSDC.
   *
   * Each step waits to be mined before the next is sent, because each one genuinely depends on
   * the one before: wrapping needs the tokens to exist and the allowance to be set. Firing all
   * three at once — which is what this used to do — meant the wrap was simulated against a chain
   * where the mint had not landed, so it reverted; and on a phone, where the second wallet prompt
   * often never surfaces, the whole thing simply hung.
   *
   * Steps already satisfied are skipped, so a retry after a half-finished attempt costs one
   * transaction rather than three.
   */
  async function getTestTokens() {
    setError(null);
    try {
      const held = (await readContract(config, {
        address: ADDRESSES.underlying,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
      })) as bigint;

      if (held < FAUCET_AMOUNT) {
        setStep("Minting test tokens · 1 of 3");
        const hash = await writeContractAsync({
          address: ADDRESSES.underlying,
          abi: erc20Abi,
          functionName: "mint",
          args: [address!, FAUCET_AMOUNT],
        });
        setLastTx(hash);
        await waitForTransactionReceipt(config, { hash });
      }

      const allowed = (await readContract(config, {
        address: ADDRESSES.underlying,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address!, ADDRESSES.cusdc],
      })) as bigint;

      if (allowed < FAUCET_AMOUNT) {
        setStep("Approving the wrapper · 2 of 3");
        const hash = await writeContractAsync({
          address: ADDRESSES.underlying,
          abi: erc20Abi,
          functionName: "approve",
          args: [ADDRESSES.cusdc, FAUCET_AMOUNT],
        });
        setLastTx(hash);
        await waitForTransactionReceipt(config, { hash });
      }

      setStep("Wrapping into cUSDC · 3 of 3");
      const hash = await writeContractAsync({
        address: ADDRESSES.cusdc,
        abi: cusdcAbi,
        functionName: "wrap",
        args: [address!, FAUCET_AMOUNT],
      });
      setLastTx(hash);
      await waitForTransactionReceipt(config, { hash });

      await Promise.all([refetchAccount(), refetchOperator()]);
    } catch (e) {
      setError(e);
    } finally {
      setStep(null);
    }
  }

  async function grantOperator() {
    await run(async () => {
      await setOperator({ operator: ADDRESSES.pool, until: OPERATOR_UNTIL });
    });
  }

  async function submitEncrypted(functionName: "deposit" | "withdraw", amount: string) {
    const parsed = parseUnits6(amount);
    if (parsed === null || parsed === 0n) {
      setError(new Error("Enter an amount above zero, with at most six decimal places."));
      return;
    }
    await run(async () => {
      const encrypted = await encrypt.mutateAsync({
        values: [{ value: parsed, type: "euint64" }],
        contractAddress: ADDRESSES.pool,
        userAddress: address!,
      });
      return writeContractAsync({
        address: ADDRESSES.pool,
        abi: TENURE_POOL_ABI,
        functionName,
        args: [encrypted.encryptedValues[0], encrypted.inputProof],
      });
    });
  }

  async function claim() {
    await run(async () =>
      writeContractAsync({
        address: ADDRESSES.pool,
        abi: TENURE_POOL_ABI,
        functionName: "claimPrize",
        args: [Number(currentEpoch ?? 0)],
      }),
    );
  }

  async function bankPrize() {
    await run(async () =>
      writeContractAsync({ address: ADDRESSES.pool, abi: TENURE_POOL_ABI, functionName: "withdrawPrize" }),
    );
  }

  async function revealBalances() {
    setError(null);
    // Nothing encrypted to read yet, so there is nothing worth a signature.
    if (decryptInputs.length === 0) return;
    try {
      if (!hasPermit) await grantPermit([ADDRESSES.pool]);
      await reveal();
    } catch (e) {
      setError(e);
    }
  }

  return {
    address,
    isConnected,
    onWrongNetwork,
    busy: busy || step !== null,
    step,
    error,
    setError,
    lastTx,

    enrolled: accountInfo ? Boolean(accountInfo[2]) : false,
    tierShift: accountInfo ? Number(accountInfo[3]) : 0,
    currentEpoch,

    clearBalance,
    clearPrize,
    revealBalances,
    revealing: revealing || granting,
    nothingToReveal: decryptInputs.length === 0,
    hasPermit: Boolean(hasPermit),

    isOperator: Boolean(isOperator),
    settingOperator,
    grantOperator,
    getTestTokens,
    submitEncrypted,
    claim,
    bankPrize,
  };
}

export type Pool = ReturnType<typeof usePool>;
