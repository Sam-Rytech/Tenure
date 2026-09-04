"use client";

import { useMemo, useState } from "react";
import { parseAbi } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  useConfidentialIsOperator,
  useConfidentialSetOperator,
  useDecryptValues,
  useEncrypt,
  useGrantPermit,
  useHasPermit,
} from "@zama-fhe/react-sdk";

import { TENURE_POOL_ABI, ERC20_ABI, CUSDC_ABI } from "@/lib/abi";
import { ADDRESSES, SEPOLIA_CHAIN_ID, formatUnits6, parseUnits6, shorten, tierLabelForShift, txUrl } from "@/lib/config";
import { describeError } from "@/lib/errors";

const erc20Abi = parseAbi(ERC20_ABI);
const cusdcAbi = parseAbi(CUSDC_ABI);

const OPERATOR_UNTIL = 2_000_000_000;
const FAUCET_AMOUNT = 5_000_000n; // 5 cUSDC

/** A single labelled row of the position card. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
      <span className="eyebrow">{label}</span>
      <span className="font-mono text-sm tabular-nums text-clear">{children}</span>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  busy,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`btn ${primary ? "btn-primary" : "btn-ghost"} text-sm`}
    >
      {busy ? "Working\u2026" : children}
    </button>
  );
}

/** Surfaces failures in the interface's own voice rather than raw revert text. */
function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const friendly = describeError(error);
  return (
    <div className="mt-4 rounded-[2px] border border-glow-dim bg-raised p-4">
      <p className="text-sm text-glow">{friendly.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{friendly.action}</p>
    </div>
  );
}

export function WalletPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [amount, setAmount] = useState("1");
  const [error, setError] = useState<unknown>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  const onWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  const { writeContractAsync, isPending: writing } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: lastTx ?? undefined });
  const busy = writing || confirming;

  // --- position -----------------------------------------------------------
  const { data: accountInfo, refetch: refetchAccount } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "accountInfo",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: balanceHandle } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: prizeHandle } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "confidentialPendingPrizeOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: currentEpoch } = useReadContract({
    address: ADDRESSES.pool,
    abi: TENURE_POOL_ABI,
    functionName: "currentEpoch",
  });

  // --- decryption ---------------------------------------------------------
  // The first EIP-712 prompt is gated behind an explicit button; the permit then caches, so
  // later reveals do not re-prompt.
  const { data: hasPermit } = useHasPermit({ contractAddresses: [ADDRESSES.pool] });
  const { mutateAsync: grantPermit, isPending: granting } = useGrantPermit();

  const decryptInputs = useMemo(() => {
    const inputs: { handle: `0x${string}`; contractAddress: `0x${string}` }[] = [];
    if (balanceHandle) inputs.push({ handle: balanceHandle as `0x${string}`, contractAddress: ADDRESSES.pool });
    if (prizeHandle) inputs.push({ handle: prizeHandle as `0x${string}`, contractAddress: ADDRESSES.pool });
    return inputs;
  }, [balanceHandle, prizeHandle]);

  const {
    data: cleartexts,
    refetch: reveal,
    isFetching: revealing,
  } = useDecryptValues(decryptInputs, { enabled: false });

  const clearBalance = balanceHandle ? cleartexts?.[balanceHandle as `0x${string}`] : undefined;
  const clearPrize = prizeHandle ? cleartexts?.[prizeHandle as `0x${string}`] : undefined;

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

  /** Mint the public mock token, approve the wrapper, then wrap into cUSDC. */
  async function getTestTokens() {
    await run(async () => {
      await writeContractAsync({
        address: ADDRESSES.underlying,
        abi: erc20Abi,
        functionName: "mint",
        args: [address!, FAUCET_AMOUNT],
      });
      await writeContractAsync({
        address: ADDRESSES.underlying,
        abi: erc20Abi,
        functionName: "approve",
        args: [ADDRESSES.cusdc, FAUCET_AMOUNT],
      });
      return writeContractAsync({
        address: ADDRESSES.cusdc,
        abi: cusdcAbi,
        functionName: "wrap",
        args: [address!, FAUCET_AMOUNT],
      });
    });
  }

  async function grantOperator() {
    await run(async () => {
      await setOperator({ operator: ADDRESSES.pool, until: OPERATOR_UNTIL });
    });
  }

  async function submitEncrypted(functionName: "deposit" | "withdraw") {
    const parsed = parseUnits6(amount);
    if (parsed === null || parsed === 0n) {
      setError(new Error("Enter an amount greater than zero, with at most six decimal places."));
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
    try {
      if (!hasPermit) await grantPermit([ADDRESSES.pool]);
      await reveal();
    } catch (e) {
      setError(e);
    }
  }

  // --- render -------------------------------------------------------------
  if (!isConnected) {
    return (
      <section className="mt-16 hairline pt-8">
        <p className="eyebrow">Your position</p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
          Everything above is public and needs no wallet. Connect one to see your own encrypted balance — only you can
          decrypt it.
        </p>
        <div className="mt-5">
          <Button
            primary
            busy={connecting}
            onClick={() => {
              const injectedConnector = connectors[0];
              if (injectedConnector) connect({ connector: injectedConnector });
            }}
          >
            Connect wallet
          </Button>
        </div>
      </section>
    );
  }

  if (onWrongNetwork) {
    return (
      <section className="mt-16 hairline pt-8">
        <p className="eyebrow">Wrong network</p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
          Tenure runs on Sepolia. Switch networks to continue.
        </p>
        <div className="mt-5">
          <Button primary onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
            Switch to Sepolia
          </Button>
        </div>
      </section>
    );
  }

  const shift = accountInfo ? Number(accountInfo[3]) : 0;
  const enrolled = accountInfo ? Boolean(accountInfo[2]) : false;

  return (
    <section className="mt-16 hairline pt-8">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Your position</p>
        <button
          type="button"
          onClick={() => disconnect()}
          className="font-mono text-xs text-muted underline underline-offset-2 hover:text-clear"
        >
          {shorten(address ?? "")}
        </button>
      </div>

      <div className="mt-5">
        <Row label="balance">
          {clearBalance !== undefined ? (
            `${formatUnits6(BigInt(clearBalance as string | bigint))} cUSDC`
          ) : (
            <span className="text-muted-dim">●●●●●●</span>
          )}
        </Row>
        <Row label="pending prize">
          {clearPrize !== undefined ? (
            `${formatUnits6(BigInt(clearPrize as string | bigint))} cUSDC`
          ) : (
            <span className="text-muted-dim">●●●●●●</span>
          )}
        </Row>
        <Row label="tenure multiplier">{enrolled ? tierLabelForShift(shift) : "—"}</Row>
        <div className="border-t border-line pt-4">
          <Button busy={revealing || granting} onClick={revealBalances}>
            {clearBalance === undefined ? "Reveal my balance" : "Refresh"}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Signs a decryption request in your wallet. The signature is cached, so this is asked once.
          </p>
        </div>
      </div>

      <p className="eyebrow mt-10">Actions</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button busy={busy} onClick={getTestTokens}>
          Get test cUSDC
        </Button>
        <Button busy={settingOperator} disabled={Boolean(isOperator)} onClick={grantOperator}>
          {isOperator ? "Pool is your operator" : "Allow the pool to move funds"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="amount">
          Amount in cUSDC
        </label>
        <input
          id="amount"
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-[2px] border border-line bg-raised px-3 py-2 font-mono text-sm tabular-nums text-clear"
        />
        <Button primary busy={busy} disabled={!isOperator} onClick={() => submitEncrypted("deposit")}>
          Deposit
        </Button>
        <Button busy={busy} disabled={!enrolled} onClick={() => submitEncrypted("withdraw")}>
          Withdraw
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button busy={busy} disabled={!enrolled} onClick={claim}>
          Claim this epoch
        </Button>
        <Button busy={busy} disabled={!enrolled} onClick={bankPrize}>
          Move prize into balance
        </Button>
      </div>

      {!isOperator && (
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted">
          ERC-7984 uses operators rather than ERC-20 approvals. Granting the pool operator rights looks like an approval
          but is a different mechanism, so it is a separate step before your first deposit.
        </p>
      )}

      {lastTx && (
        <p className="mt-4 font-mono text-xs text-muted">
          last transaction{" "}
          <a className="text-muted underline underline-offset-2 hover:text-glow" href={txUrl(lastTx)}>
            {shorten(lastTx, 10, 8)}
          </a>
        </p>
      )}

      <ErrorNote error={error} />
    </section>
  );
}
