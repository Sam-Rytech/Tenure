// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title  DrawEngine
/// @author Tenure
/// @notice The five-phase draw state machine: builds an encrypted ticket ladder, publishes the
///         weighted total, draws on-chain FHE randomness, and publishes the winning ticket
///         number `W`.
/// @dev    Abstract. `TenurePool` inherits it so every ciphertext lives at a single address,
///         which avoids cross-contract ACL grants for balances and rungs.
///
///         Decryption is **self-relaying**. Protocol v0.9 deprecated `FHE.requestDecryption`
///         and `FHE.setDecryptionOracle`, so there is no oracle callback to wait on:
///           on-chain   FHE.makePubliclyDecryptable(handle)
///           off-chain  SDK publicDecrypt(handle) -> cleartext + proof
///           on-chain   FHE.checkSignatures(handles, abi.encode(cleartext), proof)
///
///         Every phase-advancing function is permissionless and none require `msg.value`.
abstract contract DrawEngine is ZamaEthereumConfig {
    /// @notice Draw lifecycle. `abortDraw` is the escape from every non-terminal phase.
    enum Phase {
        OPEN,
        LADDER_BUILD,
        TOTAL_PENDING,
        WINNER_PENDING,
        CLAIMABLE
    }

    /// @notice One participant's encrypted ticket range, half-open as `[start, end)`.
    /// @param start Inclusive lower bound of the range.
    /// @param end   Exclusive upper bound of the range.
    struct Rung {
        euint64 start;
        euint64 end;
    }

    /// @notice Participants processed per `buildChunk` call.
    /// @dev    Depth: 20 * 162,000 = 3,240,000 against the 5,000,000 sequential ceiling.
    ///         Global: 20 * (34,000 shl + 162,000 add) = 3,920,000 against the 20,000,000
    ///         ceiling. The `shl` branches off the sequential chain, so only the `add` chain
    ///         counts toward depth. Roughly 35% headroom retained.
    uint16 public constant LADDER_CHUNK = 20;

    /// @notice How long a phase may stall before anyone may call `abortDraw`.
    /// @dev    A constructor parameter rather than a constant. A production deployment wants
    ///         hours, but a testnet demo must complete a whole cycle inside a screen recording,
    ///         and a hardcoded window would make the contract impossible to demonstrate or
    ///         iterate on. The deployed values are stated in the README.
    uint256 public immutable DRAW_TIMEOUT;

    /// @notice How long a winner has to claim before the prize may roll forward.
    /// @dev    Also a parameter, for the same reason. See {DRAW_TIMEOUT}.
    uint256 public immutable CLAIM_WINDOW;

    /// @notice The current phase of the draw machine.
    Phase public phase;

    /// @notice The epoch currently accepting deposits or being drawn.
    uint32 public currentEpoch;

    /// @notice Timestamp the current phase was entered, used by `abortDraw`.
    uint256 public phaseEnteredAt;

    /// @notice How far `buildChunk` has advanced through the participant snapshot.
    uint256 public buildCursor;

    /// @dev Running cumulative total during LADDER_BUILD; its final value is the epoch total.
    euint64 internal _runningTotal;

    /// @dev The encrypted winning number, before it is publicly decrypted.
    euint64 internal _encWinningNumber;

    /// @notice Participant count snapshotted when an epoch closed.
    mapping(uint32 epoch => uint256 count) public epochParticipantCount;

    /// @notice Weighted ticket total per epoch, plaintext once revealed. Public by design.
    mapping(uint32 epoch => uint64 total) public epochTotalTickets;

    /// @notice Winning ticket number per epoch, plaintext once revealed. Public by design.
    mapping(uint32 epoch => uint64 winningNumber) public epochWinningNumber;

    /// @notice Deadline after which an epoch's prize may no longer be claimed.
    mapping(uint32 epoch => uint256 deadline) public epochClaimDeadline;

    /// @notice Number of `claimPrize` calls per epoch. Reveals nothing about who won.
    mapping(uint32 epoch => uint256 count) public epochClaimCount;

    /// @dev Encrypted ticket ranges, keyed by epoch then by stable participant index.
    mapping(uint32 epoch => mapping(uint256 index => Rung rung)) internal _rungs;

    /// @notice Emitted when an epoch closes and ladder building begins.
    /// @param epoch            The epoch that closed.
    /// @param participantCount Participants snapshotted for this epoch.
    event EpochClosed(uint32 indexed epoch, uint256 indexed participantCount);

    /// @notice Emitted after each ladder chunk.
    /// @param epoch  The epoch being built.
    /// @param cursor Participants processed so far.
    /// @param total  Participants to process in total.
    event LadderProgress(uint32 indexed epoch, uint256 indexed cursor, uint256 indexed total);

    /// @notice Emitted when the weighted total is revealed.
    /// @param epoch        The epoch drawn.
    /// @param totalTickets The revealed weighted ticket total.
    event TotalPublished(uint32 indexed epoch, uint64 indexed totalTickets);

    /// @notice Emitted when the winning number is revealed and claiming opens.
    /// @param epoch         The epoch drawn.
    /// @param winningNumber The revealed winning ticket number.
    /// @param claimDeadline When the claim window closes.
    event WinnerPublished(uint32 indexed epoch, uint64 indexed winningNumber, uint256 indexed claimDeadline);

    /// @notice Emitted when a draw is abandoned and the prize rolls forward.
    /// @param epoch       The abandoned epoch.
    /// @param abortedFrom The phase the machine was stuck in.
    /// @param reason      Human-readable cause.
    event DrawAborted(uint32 indexed epoch, Phase indexed abortedFrom, string reason);

    /// @notice Emitted when a claim window closes and the next epoch opens.
    /// @param epoch The finalized epoch.
    event EpochFinalized(uint32 indexed epoch);

    /// @notice The machine is not in the phase this call requires.
    /// @param expected The required phase.
    /// @param actual   The current phase.
    error WrongPhase(Phase expected, Phase actual);

    /// @notice `abortDraw` was called before the timeout elapsed.
    /// @param elapsed  Seconds since the phase was entered.
    /// @param required Seconds required.
    error TimeoutNotReached(uint256 elapsed, uint256 required);

    /// @notice The ladder has not finished building.
    /// @param cursor Participants processed.
    /// @param total  Participants expected.
    error LadderIncomplete(uint256 cursor, uint256 total);

    /// @notice The claim window has not yet closed.
    /// @param deadline When it closes.
    error ClaimWindowOpen(uint256 deadline);

    /// @notice The epoch's prize has not been funded.
    /// @param epoch The unfunded epoch.
    error PrizeNotFunded(uint32 epoch);

    /// @notice The revealed winning number lies outside the published ticket range.
    /// @param winningNumber The revealed value.
    /// @param totalTickets  The published total.
    error WinnerOutOfRange(uint64 winningNumber, uint64 totalTickets);

    /// @notice A timing window below `MIN_WINDOW` was supplied at construction.
    /// @param drawTimeout The rejected stall timeout.
    /// @param claimWindow The rejected claim window.
    error InvalidTiming(uint256 drawTimeout, uint256 claimWindow);

    /// @notice Smallest permitted value for either timing window.
    /// @dev    Guards against a degenerate deployment. With `CLAIM_WINDOW = 0` the claim deadline
    ///         equals the block that opened it, so `finalizeEpoch` succeeds immediately while
    ///         `claimPrize` is only reachable inside that one block — the prize would roll
    ///         forward before any winner could realistically take it. A zero `DRAW_TIMEOUT`
    ///         likewise lets anyone abort a draw in the same block it entered a phase.
    uint256 public constant MIN_WINDOW = 60;

    /// @notice Configure the stall and claim windows.
    /// @param drawTimeout_ Seconds a phase may stall before `abortDraw` is permitted.
    /// @param claimWindow_ Seconds a winner has to claim before the prize may roll forward.
    constructor(uint256 drawTimeout_, uint256 claimWindow_) {
        if (drawTimeout_ < MIN_WINDOW || claimWindow_ < MIN_WINDOW) {
            revert InvalidTiming(drawTimeout_, claimWindow_);
        }
        DRAW_TIMEOUT = drawTimeout_;
        CLAIM_WINDOW = claimWindow_;
    }

    /// @notice Restricts a call to a single phase.
    /// @param expected The phase the call requires.
    modifier inPhase(Phase expected) {
        if (phase != expected) revert WrongPhase(expected, phase);
        _;
    }

    // ---------------------------------------------------------------------
    // Hooks implemented by TenurePool
    // ---------------------------------------------------------------------

    /// @notice Total addresses ever enrolled. Append-only, never compacted.
    /// @return count The participant array length.
    function _participantCount() internal view virtual returns (uint256 count);

    /// @notice The participant at a permanently stable index.
    /// @param  index The stable index.
    /// @return account The participant address.
    function _participantAt(uint256 index) internal view virtual returns (address account);

    /// @notice Encrypted ticket weight for an account in an epoch.
    /// @param  account The participant.
    /// @param  epoch   The epoch being built.
    /// @return weight  `balance << tierShift`, or an encrypted zero if ineligible.
    function _weightOf(address account, uint32 epoch) internal virtual returns (euint64 weight);

    /// @notice Whether an epoch's prize is actually funded in cUSDC.
    /// @param  epoch  The epoch to check.
    /// @return funded True once real funds back the prize.
    function _isPrizeFunded(uint32 epoch) internal view virtual returns (bool funded);

    /// @notice Roll an epoch's prize forward into the next epoch.
    /// @param epoch The epoch whose prize moves forward.
    function _rolloverPrize(uint32 epoch) internal virtual;

    // ---------------------------------------------------------------------
    // Phase transitions, all permissionless
    // ---------------------------------------------------------------------

    /// @notice Close the open epoch and begin building the ticket ladder.
    /// @dev    Reverts unless the prize is funded. An unfunded epoch would credit a winner an
    ///         encrypted award the pool cannot honour, and `confidentialTransfer` fails silently
    ///         by returning an encrypted zero, so this single plaintext guard is what makes that
    ///         failure unreachable. Zero participants roll over without entering the machine,
    ///         so `FHE.rem` can never see a zero divisor.
    function closeEpoch() external inPhase(Phase.OPEN) {
        uint32 epoch = currentEpoch;
        if (!_isPrizeFunded(epoch)) revert PrizeNotFunded(epoch);

        uint256 n = _participantCount();
        if (n == 0) {
            _rolloverPrize(epoch);
            currentEpoch = epoch + 1;
            emit DrawAborted(epoch, Phase.OPEN, "no participants");
            return;
        }

        epochParticipantCount[epoch] = n;
        buildCursor = 0;
        _runningTotal = FHE.asEuint64(0);
        FHE.allowThis(_runningTotal);

        _enterPhase(Phase.LADDER_BUILD);
        emit EpochClosed(epoch, n);
    }

    /// @notice Build up to `LADDER_CHUNK` rungs of the encrypted ticket ladder.
    /// @dev    Indices are permanently stable because the participant array is append-only.
    ///         Ineligible or zero-balance accounts receive weight 0 — an empty rung where
    ///         `start == end`, which can never contain `W` — rather than being skipped, and that
    ///         is precisely what preserves index stability across epochs.
    function buildChunk() external inPhase(Phase.LADDER_BUILD) {
        uint32 epoch = currentEpoch;
        uint256 n = epochParticipantCount[epoch];
        uint256 from = buildCursor;
        uint256 to = from + LADDER_CHUNK;
        if (to > n) to = n;

        euint64 running = _runningTotal;

        for (uint256 i = from; i < to; ++i) {
            euint64 weight = _weightOf(_participantAt(i), epoch);
            euint64 start = running;
            running = FHE.add(running, weight); // the sequential chain

            FHE.allowThis(start);
            FHE.allowThis(running);
            _rungs[epoch][i] = Rung({start: start, end: running});
        }

        _runningTotal = running;
        buildCursor = to;
        emit LadderProgress(epoch, to, n);

        if (to == n) {
            FHE.makePubliclyDecryptable(running);
            _enterPhase(Phase.TOTAL_PENDING);
        }
    }

    /// @notice Submit the publicly decrypted weighted total, then draw the winning number.
    /// @dev    The draw is merged into this call because randomness can only be reduced once the
    ///         plaintext total exists; doing both here removes a phase and a stall point.
    /// @param  clearTotal The decrypted total, obtained off-chain via the SDK's `publicDecrypt`.
    /// @param  proof      The KMS decryption proof returned alongside it.
    function submitTotal(uint64 clearTotal, bytes calldata proof) external inPhase(Phase.TOTAL_PENDING) {
        uint32 epoch = currentEpoch;

        uint256 expected = epochParticipantCount[epoch];
        if (buildCursor != expected) revert LadderIncomplete(buildCursor, expected);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_runningTotal);
        FHE.checkSignatures(handles, abi.encode(clearTotal), proof);

        // Every participant held a zero balance. Nothing to draw, so roll forward.
        if (clearTotal == 0) {
            _abortToOpen(epoch, "zero weighted total");
            return;
        }

        epochTotalTickets[epoch] = clearTotal;
        emit TotalPublished(epoch, clearTotal);

        // `rem` accepts a plaintext divisor only, which is exactly why the total must be public.
        // `randEuint64(bound)` cannot be used instead: it requires a power-of-two bound.
        euint64 r = FHE.randEuint64();
        euint64 w = FHE.rem(r, clearTotal);

        FHE.allowThis(w);
        FHE.makePubliclyDecryptable(w);
        _encWinningNumber = w;

        _enterPhase(Phase.WINNER_PENDING);
    }

    /// @notice Submit the publicly decrypted winning ticket number, opening the claim window.
    /// @param  clearW The decrypted winning number.
    /// @param  proof  The KMS decryption proof returned alongside it.
    function submitWinner(uint64 clearW, bytes calldata proof) external inPhase(Phase.WINNER_PENDING) {
        uint32 epoch = currentEpoch;

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_encWinningNumber);
        FHE.checkSignatures(handles, abi.encode(clearW), proof);

        uint64 total = epochTotalTickets[epoch];
        if (!(clearW < total)) revert WinnerOutOfRange(clearW, total);

        epochWinningNumber[epoch] = clearW;
        uint256 deadline = block.timestamp + CLAIM_WINDOW;
        epochClaimDeadline[epoch] = deadline;

        _enterPhase(Phase.CLAIMABLE);
        emit WinnerPublished(epoch, clearW, deadline);
    }

    /// @notice Close a finished claim window and open the next epoch.
    /// @dev    The prize rolls forward only when nobody claimed at all. Because awards are
    ///         encrypted, the contract cannot distinguish a winning claim from a losing one, so
    ///         a single claim is treated conservatively as possibly-winning. Stated as a known
    ///         limitation rather than hidden.
    function finalizeEpoch() external inPhase(Phase.CLAIMABLE) {
        uint32 epoch = currentEpoch;
        uint256 deadline = epochClaimDeadline[epoch];
        if (block.timestamp < deadline) revert ClaimWindowOpen(deadline);

        if (epochClaimCount[epoch] == 0) {
            _rolloverPrize(epoch);
        }

        currentEpoch = epoch + 1;
        _enterPhase(Phase.OPEN);
        emit EpochFinalized(epoch);
    }

    /// @notice Escape hatch for every phase that can stall. Permissionless, no `msg.value`.
    /// @dev    Unifies the separate `cancelDraw` and `abortLadder` of earlier designs: every
    ///         stall has the same shape, a phase carrying a timestamp that nobody advanced.
    function abortDraw() external {
        Phase current = phase;
        if (current == Phase.OPEN) revert WrongPhase(Phase.LADDER_BUILD, current);
        if (current == Phase.CLAIMABLE) revert WrongPhase(Phase.WINNER_PENDING, current);

        uint256 elapsed = block.timestamp - phaseEnteredAt;
        if (elapsed < DRAW_TIMEOUT) revert TimeoutNotReached(elapsed, DRAW_TIMEOUT);

        _abortToOpen(currentEpoch, "timeout");
    }

    /// @notice A participant's encrypted ticket range for an epoch.
    /// @param  epoch The epoch queried.
    /// @param  index The participant's stable index.
    /// @return start Inclusive lower bound handle.
    /// @return end   Exclusive upper bound handle.
    function rungOf(uint32 epoch, uint256 index) external view returns (euint64 start, euint64 end) {
        Rung storage r = _rungs[epoch][index];
        return (r.start, r.end);
    }

    /// @notice The encrypted weighted total, publicly decryptable once the ladder completes.
    /// @dev    The keeper reads this in `TOTAL_PENDING` and feeds it to the SDK's `publicDecrypt`.
    /// @return total The ciphertext handle.
    function encryptedTotal() external view returns (euint64 total) {
        return _runningTotal;
    }

    /// @notice The encrypted winning number, publicly decryptable once the draw has happened.
    /// @dev    The keeper reads this in `WINNER_PENDING` and feeds it to the SDK's `publicDecrypt`.
    /// @return winningNumber The ciphertext handle.
    function encryptedWinningNumber() external view returns (euint64 winningNumber) {
        return _encWinningNumber;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @notice Record a phase transition and stamp the time.
    /// @param next The phase being entered.
    function _enterPhase(Phase next) private {
        phase = next;
        phaseEnteredAt = block.timestamp;
    }

    /// @notice Abandon the current draw, roll the prize forward, and reopen.
    /// @param epoch  The epoch being abandoned.
    /// @param reason Human-readable cause, for the event log.
    function _abortToOpen(uint32 epoch, string memory reason) private {
        Phase from = phase;
        _rolloverPrize(epoch);
        buildCursor = 0;
        currentEpoch = epoch + 1;
        _enterPhase(Phase.OPEN);
        emit DrawAborted(epoch, from, reason);
    }
}
