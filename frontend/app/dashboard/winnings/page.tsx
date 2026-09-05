"use client";

import { usePool } from "@/components/dashboard/usePool";
import { ConnectGate, needsWallet } from "@/components/dashboard/ConnectGate";
import { Button, Row, PageHead, ErrorNote, LastTx } from "@/components/dashboard/ui";
import { formatUnits6 } from "@/lib/config";

export default function Winnings() {
  const pool = usePool();

  if (needsWallet(pool)) return <ConnectGate pool={pool} />;

  return (
    <>
      <PageHead
        title="Winnings"
        lede="Everyone claims the same way and everyone gets an encrypted result back, so claiming tells an onlooker nothing. You find out what you got by decrypting it yourself."
      />

      <div>
        <Row label="pending prize">
          {pool.clearPrize !== undefined ? (
            `${formatUnits6(BigInt(pool.clearPrize as string | bigint))} cUSDC`
          ) : (
            <span className="text-muted-dim">●●●●●●</span>
          )}
        </Row>
        <Row label="epoch">{pool.currentEpoch === undefined ? "—" : String(pool.currentEpoch)}</Row>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button busy={pool.busy} disabled={!pool.enrolled} onClick={pool.claim}>
          Claim this epoch
        </Button>
        <Button busy={pool.busy} disabled={!pool.enrolled} onClick={pool.bankPrize}>
          Move prize into balance
        </Button>
        <Button busy={pool.revealing} disabled={pool.nothingToReveal} onClick={pool.revealBalances}>
          Reveal result
        </Button>
      </div>

      <div className="panel mt-10 p-5 sm:p-6">
        <p className="eyebrow !text-glow">Why claiming gives nothing away</p>
        <p className="mt-2.5 max-w-[62ch] text-[0.875rem] leading-relaxed text-muted">
          A winning claim and a losing claim are the same transaction doing the same work. The pool adds an encrypted
          amount to your account either way — the prize if the winning number landed in your range, an encrypted zero if
          it did not. The contract paying out cannot tell which it just did.
        </p>
      </div>

      <ErrorNote error={pool.error} />
      <LastTx hash={pool.lastTx} />
    </>
  );
}
