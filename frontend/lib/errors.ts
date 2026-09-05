/**
 * Turns failures into messages a person can act on.
 *
 * Chain and relayer errors are hostile by default: a bare "execution reverted" or a raw custom
 * error name tells a user nothing about what to do next. Each case below names the cause and the
 * next action.
 */

export interface FriendlyError {
  /** Short, human summary. */
  title: string;
  /** What to do about it. */
  action: string;
  /** True when the user can simply retry. */
  retryable: boolean;
}

const CONTRACT_ERRORS: Record<string, FriendlyError> = {
  NotEnrolled: {
    title: "You have no position in this pool",
    action: "Deposit first. You can only claim for an epoch you were enrolled in when it closed.",
    retryable: false,
  },
  AlreadyClaimed: {
    title: "You have already claimed this epoch",
    action: "Each address may claim once per epoch. Decrypt your pending prize to see the result.",
    retryable: false,
  },
  ClaimWindowClosed: {
    title: "The claim window has closed",
    action: "This epoch's prize rolls forward to the next draw. Your principal is unaffected.",
    retryable: false,
  },
  ClaimWindowOpen: {
    title: "The claim window is still open",
    action: "Wait for it to expire before finalizing the epoch.",
    retryable: true,
  },
  EpochNotDrawn: {
    title: "This epoch has not been drawn yet",
    action: "Wait for the winning number to be published, then claim.",
    retryable: true,
  },
  PrizeNotFunded: {
    title: "This epoch has no prize funded",
    action: "The pool refuses to draw without a funded prize, so no winner can be left unpaid.",
    retryable: false,
  },
  WrongPhase: {
    title: "The draw is not in the right phase for that",
    action: "The pool advances one phase at a time. Refresh to see the current phase.",
    retryable: true,
  },
  TimeoutNotReached: {
    title: "Too early to abort the draw",
    action: "A stalled phase can only be aborted after its timeout elapses.",
    retryable: true,
  },
  LadderIncomplete: {
    title: "The ticket ladder is still being built",
    action: "Run the remaining ladder chunks before publishing the total.",
    retryable: true,
  },
  PoolFull: {
    title: "The pool has reached its participant cap",
    action: "The cap bounds the encrypted ladder total so it cannot overflow.",
    retryable: false,
  },
  NotAdmin: {
    title: "That action is restricted to the deployer",
    action: "Funding an epoch is an admin action in this demo.",
    retryable: false,
  },
  NotReserve: {
    title: "Only the prize reserve can record funding",
    action: "This protects the pool from a fabricated prize it could not pay.",
    retryable: false,
  },
};

/** Detects a substring in whatever shape the error arrived in. */
function textOf(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error)
    return `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function describeError(error: unknown): FriendlyError {
  const text = textOf(error);

  for (const [name, friendly] of Object.entries(CONTRACT_ERRORS)) {
    if (text.includes(name)) return friendly;
  }

  if (/user rejected|denied transaction|ACTION_REJECTED|4001/i.test(text)) {
    return {
      title: "You rejected the request in your wallet",
      action: "Approve it to continue. Nothing was sent.",
      retryable: true,
    };
  }

  /*
   * The wallet's own Sepolia endpoint refusing the request.
   *
   * This has to be tested before the wrong-network case below. The message that prompted it —
   * "chain is not available on free plan" — contains the word "chain", so the network branch
   * would otherwise catch it and send someone off to change a setting that is already correct.
   */
  if (/free plan|upgrade to paid|paid plan|exceeded.*quota|rate ?limit|too many requests|429/i.test(text)) {
    return {
      title: "Your wallet's Sepolia endpoint refused the request",
      action:
        "This is your wallet's own network setting rather than anything in Tenure. In MetaMask, open " +
        "Settings, Networks, Sepolia, and set the RPC URL to https://ethereum-sepolia-rpc.publicnode.com. " +
        "Then try again.",
      retryable: true,
    };
  }

  if (/chain|network|wrong network|unsupported chain|ChainMismatch/i.test(text)) {
    return {
      title: "Wrong network",
      action: "Tenure runs on Sepolia. Switch networks in your wallet.",
      retryable: true,
    };
  }

  if (/insufficient funds|gas required exceeds/i.test(text)) {
    return {
      title: "Not enough Sepolia ETH for gas",
      action: "Top up from a Sepolia faucet, then retry.",
      retryable: true,
    };
  }

  if (/operator|ERC7984UnauthorizedSpender|not authorized/i.test(text)) {
    return {
      title: "The pool is not yet your operator",
      action: "ERC-7984 uses operators rather than ERC-20 approvals. Grant the pool operator rights, then deposit.",
      retryable: true,
    };
  }

  if (/wasm|tfhe|WebAssembly|__wbindgen/i.test(text)) {
    return {
      title: "The encryption library failed to load",
      action: "Reload the page. If it persists, your browser may be blocking WebAssembly or the Zama CDN.",
      retryable: true,
    };
  }

  if (/relayer|UND_ERR_CONNECT_TIMEOUT|fetch failed|ECONNREFUSED|ETIMEDOUT|NetworkError|Failed to fetch/i.test(text)) {
    return {
      title: "The Zama relayer is unreachable",
      action:
        "Encryption and decryption route through Zama's relayer, which is intermittently slow. Wait a moment and retry.",
      retryable: true,
    };
  }

  if (/decrypt|signature|EIP-712|permit/i.test(text)) {
    return {
      title: "Decryption did not complete",
      action: "Sign the decryption request in your wallet. Only you can read your own balance.",
      retryable: true,
    };
  }

  if (/execution reverted/i.test(text)) {
    return {
      title: "The transaction was rejected by the contract",
      action: "Check the current draw phase; most actions are only valid in certain phases.",
      retryable: true,
    };
  }

  return {
    title: "Something went wrong",
    action: text.slice(0, 200) || "No further detail was returned.",
    retryable: true,
  };
}
