"use client";

import { useState } from "react";

import { usePool } from "@/components/dashboard/usePool";
import { ConnectGate, needsWallet } from "@/components/dashboard/ConnectGate";
import { Button, PageHead, ErrorNote, LastTx } from "@/components/dashboard/ui";

export default function Deposit() {
  const pool = usePool();
  const [amount, setAmount] = useState("1");

  if (needsWallet(pool)) return <ConnectGate pool={pool} />;

  return (
    <>
      <PageHead
        title="Deposit and withdraw"
        lede="Your amount is encrypted in the browser before it is sent, so the chain never sees the figure. You can take your money out at any point in a draw."
      />

      <section>
        <p className="eyebrow">First, two setup steps</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button busy={pool.busy} onClick={pool.getTestTokens}>
            Get test cUSDC
          </Button>
          <Button busy={pool.settingOperator} disabled={pool.isOperator} onClick={pool.grantOperator}>
            {pool.isOperator ? "Pool can move your funds" : "Let the pool move funds"}
          </Button>
        </div>
        {!pool.isOperator && (
          <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-muted">
            The confidential token uses operators instead of the usual approvals. It looks like an approval but works
            differently, so it is its own step before your first deposit.
          </p>
        )}
      </section>

      <section className="mt-10">
        <p className="eyebrow">Amount</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="amount">
            Amount in cUSDC
          </label>
          <input
            id="amount"
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded-[2px] border border-line bg-raised px-3 py-2 font-mono text-base tabular-nums text-clear sm:text-[0.8125rem]"
          />
          <Button
            primary
            busy={pool.busy}
            disabled={!pool.isOperator}
            onClick={() => pool.submitEncrypted("deposit", amount)}
          >
            Deposit
          </Button>
          <Button busy={pool.busy} disabled={!pool.enrolled} onClick={() => pool.submitEncrypted("withdraw", amount)}>
            Withdraw
          </Button>
        </div>
        <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-muted">
          Depositing or withdrawing sets your tenure back to the first tier. That is what stops someone holding a tiny
          balance for months and then arriving with a large one just before a draw.
        </p>
      </section>

      <ErrorNote error={pool.error} />
      <LastTx hash={pool.lastTx} />
    </>
  );
}
