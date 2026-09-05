"use client";

import { useAccount, useDisconnect } from "wagmi";

import { usePool } from "@/components/dashboard/usePool";
import { ConnectGate, needsWallet } from "@/components/dashboard/ConnectGate";
import { Button, Row, PageHead, ErrorNote } from "@/components/dashboard/ui";
import { formatUnits6, shorten, tierLabelForShift } from "@/lib/config";

export default function Overview() {
  const pool = usePool();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  if (needsWallet(pool)) return <ConnectGate pool={pool} />;

  return (
    <>
      <PageHead
        title="Your position"
        lede="Your balance is a ciphertext. The pool can compute with it, but nobody can read it — including us. Press reveal and it is decrypted in your browser, for you."
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">Connected</p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-muted">{shorten(address ?? "")}</span>
          <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-[2px] text-xs text-glow underline underline-offset-2 hover:text-clear"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="mt-5">
        <Row label="balance">
          {pool.clearBalance !== undefined ? (
            `${formatUnits6(BigInt(pool.clearBalance as string | bigint))} cUSDC`
          ) : (
            <span className="text-muted-dim">●●●●●●</span>
          )}
        </Row>
        <Row label="pending prize">
          {pool.clearPrize !== undefined ? (
            `${formatUnits6(BigInt(pool.clearPrize as string | bigint))} cUSDC`
          ) : (
            <span className="text-muted-dim">●●●●●●</span>
          )}
        </Row>
        <Row label="tenure multiplier">{pool.enrolled ? tierLabelForShift(pool.tierShift) : "—"}</Row>
      </div>

      <div className="mt-6">
        <Button busy={pool.revealing} disabled={pool.nothingToReveal} onClick={pool.revealBalances}>
          {pool.clearBalance === undefined ? "Reveal my balance" : "Refresh"}
        </Button>
        <p className="mt-3 max-w-[58ch] text-xs leading-relaxed text-muted">
          {pool.nothingToReveal
            ? "Nothing encrypted to read yet. Deposit, and your balance becomes a ciphertext only you can open."
            : "This asks your wallet for one signature. It is saved, so you are only asked once."}
        </p>
      </div>

      <ErrorNote error={pool.error} />
    </>
  );
}
