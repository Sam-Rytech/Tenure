// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  MockUSDC
/// @author Tenure
/// @notice Test-only stand-in for Zama's Sepolia Mock USDC (0x9b5Cd13b...58aDFfF).
/// @dev    Six decimals, matching the real mock, so the ERC-7984 wrapper reports `rate() == 1`
///         and one underlying unit maps to one confidential unit. Minting is public, mirroring
///         the faucet behaviour the brief asks us to document. Never deployed to a live network:
///         on Sepolia we use Zama's published token instead.
contract MockUSDC is ERC20 {
    /// @notice Deploy the mock token.
    constructor() ERC20("Mock USDC", "USDC") {}

    /// @notice Six decimals, matching the real Sepolia mock.
    /// @return The token's decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint freely, as the public faucet does.
    /// @param to     Recipient of the minted tokens.
    /// @param amount Amount in base units.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
