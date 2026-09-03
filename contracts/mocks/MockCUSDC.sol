// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
// solhint-disable-next-line max-line-length
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/// @title  MockCUSDC
/// @author Tenure
/// @notice Test-only stand-in for Zama's Sepolia cUSDC wrapper (0x7c5BF43B...2C223639).
/// @dev    A concrete instantiation of OpenZeppelin's abstract `ERC7984ERC20Wrapper`, which is
///         the same contract the real deployment uses. Never deployed to a live network.
contract MockCUSDC is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    /// @notice Deploy the wrapper over an underlying ERC-20.
    /// @param underlying_ The plaintext token to wrap.
    constructor(IERC20 underlying_) ERC7984("Confidential USDC", "cUSDC", "") ERC7984ERC20Wrapper(underlying_) {}
}
