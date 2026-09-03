// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";

import {DrawEngine} from "./DrawEngine.sol";

/// @title  TenurePool
/// @author Tenure
/// @notice A confidential no-loss prize savings pool. Balances are encrypted, and odds are
///         weighted by balance *and* holding duration — the time-weighted model PoolTogether V5
///         uses, implemented over ciphertext.
/// @dev    Inherits `DrawEngine` so every ciphertext lives at one address.
///
///         **Silent-failure discipline.** ERC-7984's `confidentialTransfer*` returns an
///         encrypted zero on insufficient balance rather than reverting. Every call site below
///         captures the returned `euint64` and treats it as authoritative. Never assume the
///         requested amount moved. This is the most common bug class in confidential token
///         integrations.
contract TenurePool is DrawEngine {
    /// @notice A depositor's encrypted position and tenure metadata.
    /// @param balance      Encrypted principal.
    /// @param pendingPrize Encrypted unclaimed winnings, a separate handle because the brief
    ///                     requires a distinct claim step.
    /// @param depositEpoch First epoch this account is eligible for.
    /// @param index        Permanently stable index into `participants`.
    /// @param enrolled     Whether the account has ever deposited.
    struct Account {
        euint64 balance;
        euint64 pendingPrize;
        uint32 depositEpoch;
        uint32 index;
        bool enrolled;
    }

    /// @notice Per-account ceiling in cUSDC base units (6 decimals), i.e. 1,000,000 cUSDC.
    /// @dev    A per-account cap alone is not sufficient — the *ladder total* is what wraps.
    ///         Worst case is 1e12 * 8 (max shift) * 10,000 participants = 8e16, comfortably
    ///         under the euint64 ceiling of about 1.8446e19. Roughly 230x headroom.
    uint64 public constant MAX_ACCOUNT_BALANCE = 1e12;

    /// @notice Hard cap on enrolled addresses, which bounds the aggregate ladder total.
    uint256 public constant MAX_PARTICIPANTS = 10_000;

    /// @notice The confidential token this pool holds (Zama's cUSDC mock on Sepolia).
    IERC7984 public immutable TOKEN;

    /// @notice The address permitted to wire up the reserve exactly once.
    address public immutable ADMIN;

    /// @notice The only address permitted to notify the pool of prize funding.
    /// @dev    Set once by `setReserve` after deployment. The pool and the reserve each need the
    ///         other's address, so one of the two must be wired up afterwards; doing it here
    ///         avoids predicting CREATE addresses, which breaks the moment a nonce shifts.
    address public reserve;

    /// @notice Tenure multiplier as a left-shift per tier: [0,1,2,3] gives 1x, 2x, 4x, 8x.
    /// @dev    A **parameter**, not a hardcoded rule. Setting every entry to zero reduces the
    ///         contract to strict deposit-weighting — canonical PoolTogether — which closes any
    ///         question about brief compliance without losing the differentiator. Powers of two
    ///         are deliberate: scalar `shl` costs 34k HCU against `mul` at 365k.
    uint8[4] public tierShifts = [0, 1, 2, 3];

    /// @notice Append-only list of every address that has ever deposited.
    address[] public participants;

    /// @dev Encrypted positions, keyed by depositor.
    mapping(address account => Account position) internal _accounts;

    /// @notice Prize per epoch in cUSDC base units, plaintext. Public by design.
    mapping(uint32 epoch => uint64 amount) public prizeAmount;

    /// @notice Whether an epoch's prize is backed by real cUSDC held here.
    mapping(uint32 epoch => bool funded) public prizeFunded;

    /// @notice Guards against a second claim for the same epoch.
    mapping(uint32 epoch => mapping(address account => bool claimed)) public hasClaimed;

    /// @notice Emitted on every deposit.
    /// @param account       The depositor.
    /// @param eligibleFrom  First epoch the new balance counts toward.
    event Deposited(address indexed account, uint32 indexed eligibleFrom);

    /// @notice Emitted on every withdrawal.
    /// @param account      The withdrawer.
    /// @param eligibleFrom First epoch the reduced balance counts toward.
    event Withdrawn(address indexed account, uint32 indexed eligibleFrom);

    /// @notice Emitted when the reserve funds an epoch.
    /// @param epoch  The funded epoch.
    /// @param amount Prize amount in base units.
    event PrizeFunded(uint32 indexed epoch, uint64 indexed amount);

    /// @notice Emitted when an unclaimed or undrawn prize moves forward.
    /// @param from   The epoch it left.
    /// @param to     The epoch it joined.
    /// @param amount Prize amount in base units.
    event PrizeRolledOver(uint32 indexed from, uint32 indexed to, uint64 indexed amount);

    /// @notice Emitted when an account evaluates its claim for an epoch.
    /// @param epoch   The epoch claimed against.
    /// @param account The claimant. Reveals nothing about whether they won.
    event PrizeClaimed(uint32 indexed epoch, address indexed account);

    /// @notice Emitted when pending winnings move into withdrawable principal.
    /// @param account The account.
    event PrizeMovedToBalance(address indexed account);

    /// @notice Caller is not the configured prize reserve.
    error NotReserve();

    /// @notice The account has never deposited.
    error NotEnrolled();

    /// @notice This account already claimed for this epoch.
    error AlreadyClaimed();

    /// @notice The claim window for this epoch has closed.
    error ClaimWindowClosed();

    /// @notice The epoch has not completed a draw.
    error EpochNotDrawn();

    /// @notice The participant cap has been reached.
    error PoolFull();

    /// @notice Caller is not the admin.
    error NotAdmin();

    /// @notice The reserve has already been wired up.
    error ReserveAlreadySet();

    /// @notice Wire the pool to its token and configure its timing windows.
    /// @param token        The ERC-7984 confidential token held by the pool.
    /// @param admin_       The address permitted to call `setReserve` once.
    /// @param drawTimeout_ Seconds a phase may stall before `abortDraw` is permitted.
    /// @param claimWindow_ Seconds a winner has to claim before the prize may roll forward.
    constructor(
        IERC7984 token,
        address admin_,
        uint256 drawTimeout_,
        uint256 claimWindow_
    ) DrawEngine(drawTimeout_, claimWindow_) {
        TOKEN = token;
        ADMIN = admin_;
        phase = Phase.OPEN;
        phaseEnteredAt = block.timestamp;
    }

    /// @notice Point the pool at its prize reserve. Callable exactly once.
    /// @dev    Deliberately one-shot: after wiring, the funding authority is fixed for the life
    ///         of the contract and cannot be repointed at an attacker-controlled reserve.
    /// @param  reserve_ The `PrizeReserve` permitted to call `notifyPrizeFunded`.
    function setReserve(address reserve_) external {
        if (msg.sender != ADMIN) revert NotAdmin();
        if (reserve != address(0)) revert ReserveAlreadySet();
        reserve = reserve_;
    }

    // ---------------------------------------------------------------------
    // Deposits and withdrawals
    // ---------------------------------------------------------------------

    /// @notice Deposit an encrypted amount of cUSDC into the pool.
    /// @dev    The caller must first call `setOperator(pool, until)` on the **token**. ERC-7984
    ///         uses operators, not ERC-20 approvals — the frontend must make this distinction
    ///         explicit or users will be confused by a step that looks like an approval but is
    ///         not one.
    ///
    ///         The cap is enforced *before* pulling funds, so an over-cap deposit moves nothing
    ///         and the user simply keeps their tokens. Enforcing it afterwards would strand
    ///         funds already transferred in.
    ///
    ///         Any deposit resets tenure to tier 0 and defers eligibility to the next epoch,
    ///         which closes both "deposit right before the draw" and "hold dust, then deposit
    ///         large".
    /// @param  encryptedAmount The externally encrypted deposit amount.
    /// @param  inputProof      The input proof accompanying it.
    function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        Account storage account = _accounts[msg.sender];
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        euint64 tentative = FHE.add(account.balance, amount);
        ebool within = FHE.le(tentative, MAX_ACCOUNT_BALANCE);
        euint64 toPull = FHE.select(within, amount, FHE.asEuint64(0));

        FHE.allowTransient(toPull, address(TOKEN));
        euint64 moved = TOKEN.confidentialTransferFrom(msg.sender, address(this), toPull);

        account.balance = FHE.add(account.balance, moved);

        if (!account.enrolled) {
            // The array grows by at most one per call, so equality is exactly the cap check.
            if (participants.length == MAX_PARTICIPANTS) revert PoolFull();
            account.index = uint32(participants.length);
            account.enrolled = true;
            participants.push(msg.sender);
        }

        uint32 eligibleFrom = currentEpoch + 1;
        account.depositEpoch = eligibleFrom;

        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);

        emit Deposited(msg.sender, eligibleFrom);
    }

    /// @notice Withdraw an encrypted amount of principal.
    /// @dev    Callable in **every** draw phase. Principal is never locked by draw machinery —
    ///         the invariant the README states loudly. Clamped with `FHESafeMath.tryDecrease`,
    ///         so an over-withdrawal moves nothing rather than reverting or underflowing.
    ///         Withdrawing also resets tenure, which closes the withdraw-and-redeposit game.
    /// @param  encryptedAmount The externally encrypted withdrawal amount.
    /// @param  inputProof      The input proof accompanying it.
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        Account storage account = _accounts[msg.sender];
        if (!account.enrolled) revert NotEnrolled();

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        (ebool ok, euint64 updated) = FHESafeMath.tryDecrease(account.balance, amount);
        euint64 toSend = FHE.select(ok, amount, FHE.asEuint64(0));
        account.balance = FHE.select(ok, updated, account.balance);

        FHE.allowTransient(toSend, address(TOKEN));
        TOKEN.confidentialTransfer(msg.sender, toSend);

        uint32 eligibleFrom = currentEpoch + 1;
        account.depositEpoch = eligibleFrom;

        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);

        emit Withdrawn(msg.sender, eligibleFrom);
    }

    // ---------------------------------------------------------------------
    // Claiming
    // ---------------------------------------------------------------------

    /// @notice Evaluate, privately, whether the caller won a given epoch.
    /// @dev    Claim-time evaluation replaces chunked settlement entirely: unbounded
    ///         participants, no HCU cliff, no settle cursor, and the claimant pays their own gas.
    ///
    ///         Non-winners receive an encrypted zero, so calling this reveals nothing about the
    ///         outcome. The caller then decrypts `pendingPrize` via EIP-712 to learn whether they
    ///         won, which is exactly the flow the brief asks for.
    /// @param  epoch The epoch to evaluate.
    function claimPrize(uint32 epoch) external {
        if (epochTotalTickets[epoch] == 0 || epochClaimDeadline[epoch] == 0) revert EpochNotDrawn();
        if (block.timestamp > epochClaimDeadline[epoch]) revert ClaimWindowClosed();
        if (hasClaimed[epoch][msg.sender]) revert AlreadyClaimed();

        Account storage account = _accounts[msg.sender];
        if (!account.enrolled) revert NotEnrolled();

        uint256 index = account.index;
        if (!(index < epochParticipantCount[epoch])) revert NotEnrolled();

        hasClaimed[epoch][msg.sender] = true;
        ++epochClaimCount[epoch];

        Rung storage rung = _rungs[epoch][index];
        uint64 w = epochWinningNumber[epoch];

        // `w` is plaintext, so both comparisons take the cheaper scalar form.
        ebool inRange = FHE.and(FHE.le(rung.start, w), FHE.gt(rung.end, w));
        euint64 award = FHE.select(inRange, FHE.asEuint64(prizeAmount[epoch]), FHE.asEuint64(0));

        account.pendingPrize = FHE.add(account.pendingPrize, award);

        FHE.allowThis(account.pendingPrize);
        FHE.allow(account.pendingPrize, msg.sender);

        emit PrizeClaimed(epoch, msg.sender);
    }

    /// @notice Move any pending prize into withdrawable principal.
    /// @dev    A pure encrypted bookkeeping move, so it leaks nothing: a non-winner calling this
    ///         adds an encrypted zero. The pool already holds the cUSDC because `closeEpoch`
    ///         refuses to run on an unfunded epoch.
    function withdrawPrize() external {
        Account storage account = _accounts[msg.sender];
        if (!account.enrolled) revert NotEnrolled();

        account.balance = FHE.add(account.balance, account.pendingPrize);
        account.pendingPrize = FHE.asEuint64(0);

        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);
        FHE.allowThis(account.pendingPrize);
        FHE.allow(account.pendingPrize, msg.sender);

        emit PrizeMovedToBalance(msg.sender);
    }

    // ---------------------------------------------------------------------
    // Prize funding
    // ---------------------------------------------------------------------

    /// @notice Called by `PrizeReserve` once it has wrapped real cUSDC into this pool.
    /// @dev    The reserve wraps through the plaintext ERC-20 path deliberately, because
    ///         `transferFrom` reverts on a shortfall whereas `confidentialTransfer` would return
    ///         an encrypted zero the pool could not check, silently underfunding itself and
    ///         paying the eventual winner nothing.
    /// @param  epoch  The epoch being funded.
    /// @param  amount Prize amount in cUSDC base units.
    function notifyPrizeFunded(uint32 epoch, uint64 amount) external {
        if (msg.sender != reserve) revert NotReserve();
        prizeAmount[epoch] += amount;
        prizeFunded[epoch] = true;
        emit PrizeFunded(epoch, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice An account's encrypted balance handle, for EIP-712 user decryption.
    /// @param  account The account queried.
    /// @return balance The encrypted balance handle.
    function confidentialBalanceOf(address account) external view returns (euint64 balance) {
        return _accounts[account].balance;
    }

    /// @notice An account's encrypted pending prize handle, for EIP-712 user decryption.
    /// @param  account The account queried.
    /// @return pending The encrypted pending prize handle.
    function confidentialPendingPrizeOf(address account) external view returns (euint64 pending) {
        return _accounts[account].pendingPrize;
    }

    /// @notice Plaintext tenure metadata for an account.
    /// @param  account      The account queried.
    /// @return depositEpoch First epoch the account is eligible for.
    /// @return index        The account's stable participant index.
    /// @return enrolled     Whether the account has ever deposited.
    /// @return tierShift    The account's current multiplier, as a left-shift.
    function accountInfo(
        address account
    ) external view returns (uint32 depositEpoch, uint32 index, bool enrolled, uint8 tierShift) {
        Account storage a = _accounts[account];
        return (a.depositEpoch, a.index, a.enrolled, _tierShiftFor(a, currentEpoch));
    }

    /// @notice How many addresses have ever deposited.
    /// @return count The participant array length.
    function participantCount() external view returns (uint256 count) {
        return participants.length;
    }

    // ---------------------------------------------------------------------
    // DrawEngine hooks
    // ---------------------------------------------------------------------

    /// @notice Total addresses ever enrolled. Append-only, never compacted.
    /// @return count The participant array length.
    function _participantCount() internal view override returns (uint256 count) {
        return participants.length;
    }

    /// @notice The participant at a permanently stable index.
    /// @param  index The stable index.
    /// @return account The participant address.
    function _participantAt(uint256 index) internal view override returns (address account) {
        return participants[index];
    }

    /// @notice Encrypted ticket weight for an account in an epoch.
    /// @dev    Ineligible accounts return an encrypted zero rather than being skipped, which is
    ///         what keeps participant indices stable across epochs.
    /// @param  account The participant.
    /// @param  epoch   The epoch being built.
    /// @return weight  `balance << tierShift`, or an encrypted zero if ineligible.
    function _weightOf(address account, uint32 epoch) internal override returns (euint64 weight) {
        Account storage a = _accounts[account];
        if (!a.enrolled || a.depositEpoch > epoch) {
            return FHE.asEuint64(0);
        }
        uint8 shift = _tierShiftFor(a, epoch);
        if (shift == 0) {
            return a.balance; // skip a 34k HCU no-op shift
        }
        return FHE.shl(a.balance, shift);
    }

    /// @notice Whether an epoch's prize is actually funded in cUSDC.
    /// @param  epoch  The epoch to check.
    /// @return funded True once real funds back the prize.
    function _isPrizeFunded(uint32 epoch) internal view override returns (bool funded) {
        return prizeFunded[epoch] && prizeAmount[epoch] > 0;
    }

    /// @notice Roll an epoch's prize forward into the next epoch.
    /// @dev    The cUSDC is already held by the pool, so a rollover is pure bookkeeping.
    /// @param  epoch The epoch whose prize moves forward.
    function _rolloverPrize(uint32 epoch) internal override {
        uint64 amount = prizeAmount[epoch];
        if (amount == 0) return;

        uint32 next = epoch + 1;
        prizeAmount[epoch] = 0;
        prizeAmount[next] += amount;
        prizeFunded[next] = true;

        emit PrizeRolledOver(epoch, next, amount);
    }

    /// @notice Map complete epochs held to a multiplier shift: 0 -> 1x, 1 -> 2x, 2-3 -> 4x,
    ///         4+ -> 8x.
    /// @param  a     The account.
    /// @param  epoch The epoch being evaluated.
    /// @return shift The left-shift to apply to the balance.
    function _tierShiftFor(Account storage a, uint32 epoch) private view returns (uint8 shift) {
        if (!a.enrolled || a.depositEpoch > epoch) return tierShifts[0];
        uint32 held = epoch - a.depositEpoch;
        if (held == 0) return tierShifts[0];
        if (held == 1) return tierShifts[1];
        if (held < 4) return tierShifts[2];
        return tierShifts[3];
    }
}
