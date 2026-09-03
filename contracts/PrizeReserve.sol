// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title  IERC20Minimal
/// @author Tenure
/// @notice The ERC-20 surface this reserve uses.
/// @dev    Declared locally so the reserve carries no dependency beyond the FHE type used by
///         the wrapper's return value.
interface IERC20Minimal {
    /// @notice Approve a spender.
    /// @param  spender The approved address.
    /// @param  value   The allowance.
    /// @return success Whether the approval succeeded.
    function approve(address spender, uint256 value) external returns (bool success);

    /// @notice Move tokens on behalf of an owner.
    /// @param  from    The owner.
    /// @param  to      The recipient.
    /// @param  value   The amount.
    /// @return success Whether the transfer succeeded.
    function transferFrom(address from, address to, uint256 value) external returns (bool success);

    /// @notice Move tokens held by this contract.
    /// @param  to      The recipient.
    /// @param  value   The amount.
    /// @return success Whether the transfer succeeded.
    function transfer(address to, uint256 value) external returns (bool success);

    /// @notice Read a balance.
    /// @param  account The account queried.
    /// @return amount  The balance.
    function balanceOf(address account) external view returns (uint256 amount);
}

/// @title  IWrapperMinimal
/// @author Tenure
/// @notice The subset of OpenZeppelin's `ERC7984ERC20Wrapper` this contract uses.
interface IWrapperMinimal {
    /// @notice Wrap underlying ERC-20 and credit the confidential balance of a recipient.
    /// @param  to      The recipient of the confidential balance.
    /// @param  amount  Underlying units to wrap.
    /// @return wrapped The encrypted amount credited.
    function wrap(address to, uint256 amount) external returns (euint64 wrapped);

    /// @notice The wrapped ERC-20.
    /// @return token The underlying token address.
    function underlying() external view returns (address token);

    /// @notice Underlying units per confidential unit.
    /// @return value The conversion rate.
    function rate() external view returns (uint256 value);
}

/// @title  ITenurePool
/// @author Tenure
/// @notice The pool callback this reserve invokes after funding.
interface ITenurePool {
    /// @notice Record that an epoch's prize is backed by real funds.
    /// @param epoch  The funded epoch.
    /// @param amount The prize amount in confidential base units.
    function notifyPrizeFunded(uint32 epoch, uint64 amount) external;
}

/// @title  PrizeReserve
/// @author Tenure
/// @notice Admin-funded prize source. Holds **plaintext** ERC-20 (Zama's Mock USDC on Sepolia)
///         and wraps it into confidential cUSDC directly to the pool.
/// @dev    The brief explicitly permits an admin-funded reserve in place of a real yield source.
///         A production deployment plugs a yield adapter — a Morpho vault, as in Zama's own
///         Confidential Vault — in behind `fundEpoch`.
///
///         **Why the plaintext path is deliberate.** Funding could route through
///         `confidentialTransfer`, but that returns an encrypted zero on a shortfall rather than
///         reverting, so the pool would silently underfund itself and pay the eventual winner
///         nothing, with no error anywhere. ERC-20 `transferFrom` reverts instead, so funding
///         fails loudly. Prize amounts are public by design, so nothing is lost by it.
contract PrizeReserve {
    /// @notice The plaintext ERC-20 backing the prize.
    IERC20Minimal public immutable UNDERLYING;

    /// @notice The ERC-7984 wrapper that converts underlying into confidential balance.
    IWrapperMinimal public immutable WRAPPER;

    /// @notice The pool that receives wrapped prizes.
    ITenurePool public immutable POOL;

    /// @notice The address permitted to fund and sweep.
    address public admin;

    /// @notice Emitted when an epoch is funded.
    /// @param epoch  The funded epoch.
    /// @param amount The prize amount.
    event Funded(uint32 indexed epoch, uint64 indexed amount);

    /// @notice Emitted when admin rights move.
    /// @param from The previous admin.
    /// @param to   The new admin.
    event AdminTransferred(address indexed from, address indexed to);

    /// @notice Emitted when stranded underlying is recovered.
    /// @param to     The recipient.
    /// @param amount The amount recovered.
    event Swept(address indexed to, uint256 indexed amount);

    /// @notice Caller is not the admin.
    error NotAdmin();

    /// @notice A zero amount was supplied or no balance was available.
    error ZeroAmount();

    /// @notice The wrapper uses a conversion rate this contract does not handle.
    /// @param rate The unsupported rate.
    error UnsupportedRate(uint256 rate);

    /// @notice The wrapper approval failed.
    error ApprovalFailed();

    /// @notice Pulling underlying from the admin failed.
    error PullFailed();

    /// @notice Restricts a call to the admin.
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /// @notice Wire the reserve to its token, wrapper, and pool.
    /// @param underlying_ The plaintext ERC-20 backing prizes.
    /// @param wrapper_    The ERC-7984 wrapper for that token.
    /// @param pool_       The pool to fund.
    /// @param admin_      The initial admin.
    constructor(IERC20Minimal underlying_, IWrapperMinimal wrapper_, ITenurePool pool_, address admin_) {
        UNDERLYING = underlying_;
        WRAPPER = wrapper_;
        POOL = pool_;
        admin = admin_;
    }

    /// @notice Pull underlying from the admin, wrap it into cUSDC held by the pool, and record
    ///         the epoch's prize.
    /// @dev    Every step reverts on failure, so a partially funded epoch is impossible. The
    ///         pool refuses to `closeEpoch` until this has run, which is what makes "winner
    ///         receives an encrypted zero from an empty pool" unreachable.
    /// @param  epoch  The epoch this prize belongs to.
    /// @param  amount Underlying units to wrap. With `rate() == 1` this equals the confidential
    ///                amount credited to the pool.
    function fundEpoch(uint32 epoch, uint64 amount) external onlyAdmin {
        if (amount == 0) revert ZeroAmount();

        uint256 conversionRate = WRAPPER.rate();
        if (conversionRate != 1) revert UnsupportedRate(conversionRate);

        if (!UNDERLYING.transferFrom(msg.sender, address(this), amount)) revert PullFailed();
        if (!UNDERLYING.approve(address(WRAPPER), amount)) revert ApprovalFailed();

        WRAPPER.wrap(address(POOL), amount);
        POOL.notifyPrizeFunded(epoch, amount);

        emit Funded(epoch, amount);
    }

    /// @notice Recover any underlying left stranded in this contract.
    /// @dev    Part of the "no failure path strands funds" invariant.
    /// @param  to The recipient of the recovered balance.
    function sweep(address to) external onlyAdmin {
        uint256 balance = UNDERLYING.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        UNDERLYING.transfer(to, balance);
        emit Swept(to, balance);
    }

    /// @notice Hand admin rights to another address.
    /// @param  to The new admin.
    function transferAdmin(address to) external onlyAdmin {
        emit AdminTransferred(admin, to);
        admin = to;
    }
}
