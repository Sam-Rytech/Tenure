// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title  DecryptProbe
/// @author Tenure
/// @notice Test-only fixture proving the self-relaying public decryption round trip works in the
///         Hardhat mock environment.
/// @dev    Mirrors exactly what `DrawEngine.submitTotal` and `submitWinner` do, in isolation:
///         mark a handle publicly decryptable, then verify the KMS proof over its cleartext.
///         Not deployed to any live network.
contract DecryptProbe is ZamaEthereumConfig {
    /// @notice The cleartext accepted after signature verification.
    uint64 public revealed;

    /// @notice Whether `finalize` has run successfully.
    bool public verified;

    euint64 private _value;

    /// @notice Store a value and mark it publicly decryptable.
    /// @param  v The plaintext to encrypt on-chain.
    function seed(uint64 v) external {
        _value = FHE.asEuint64(v);
        FHE.allowThis(_value);
        FHE.makePubliclyDecryptable(_value);
    }

    /// @notice The encrypted handle, for off-chain `publicDecrypt`.
    /// @return value The ciphertext handle.
    function handle() external view returns (euint64 value) {
        return _value;
    }

    /// @notice Verify a KMS decryption proof and accept the cleartext.
    /// @param  clear The decrypted value obtained off-chain.
    /// @param  proof The KMS decryption proof returned alongside it.
    function finalize(uint64 clear, bytes calldata proof) external {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_value);
        FHE.checkSignatures(handles, abi.encode(clear), proof);
        revealed = clear;
        verified = true;
    }
}
