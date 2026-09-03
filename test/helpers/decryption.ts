import { ethers } from "hardhat";

/**
 * Builds the `decryptionProof` bytes that `FHE.checkSignatures` expects, for tests running
 * against the FHEVM mock environment.
 *
 * Why this exists: the real flow gets its proof from the relayer via the SDK's `publicDecrypt`.
 * In Hardhat, `fhevm.debugger.createDecryptionSignatures` would do the same, but it needs the
 * `fhevm_createDecryptionSignatures` RPC method, which the EDR provider does not implement.
 * `checkSignatures` is genuinely enforced in mock mode, so the proof cannot be faked.
 *
 * The mock KMS runs a single signer with threshold 1, and its private key is published as a
 * constant in `@fhevm/hardhat-plugin` (src/internal/constants.ts) precisely so tests can sign.
 * It is a well-known test key, not a secret, and it has no meaning on any live network.
 *
 * Proof layout, mirroring the KMS:
 *   uint8(numSigners) ++ packed signatures ++ extraData
 */

/** Published mock KMS signer key → 0x0971C80fF03B428fD2094dd5354600ab103201C5. */
const MOCK_KMS_SIGNER_PRIVATE_KEY = "0x388b7680e4e1afa06efbfd45cdd1fe39f3c6af381df6555a19661f283b97de91";

/** The `extraData` v0 marker: a single zero byte. */
const EXTRA_DATA = "0x00";

const PUBLIC_DECRYPT_TYPES = {
  PublicDecryptVerification: [
    { name: "ctHandles", type: "bytes32[]" },
    { name: "decryptedResult", type: "bytes" },
    { name: "extraData", type: "bytes" },
  ],
};

const KMS_VERIFIER_ABI = [
  "function eip712Domain() view returns (bytes1,string,string,uint256,address,bytes32,uint256[])",
];

/**
 * Reads the live EIP-712 domain from the mock KMSVerifier rather than hardcoding it, so the
 * helper keeps working if the plugin changes chain id or verifying contract.
 *
 * @param kmsVerifierAddress Address from `fhevm.getCoprocessorConfig(contract)`.
 */
async function readDomain(kmsVerifierAddress: string) {
  const kms = new ethers.Contract(kmsVerifierAddress, KMS_VERIFIER_ABI, ethers.provider);
  const d = await kms.eip712Domain();
  return {
    name: d[1] as string,
    version: d[2] as string,
    chainId: d[3] as bigint,
    verifyingContract: d[4] as string,
  };
}

/**
 * Produce a valid decryption proof over the given handles and cleartexts.
 *
 * @param kmsVerifierAddress The mock KMSVerifier address.
 * @param handles            Ciphertext handles, in the exact order the contract will rebuild them.
 * @param clearValues        Their decrypted values, in the same order.
 * @returns The `bytes` blob to pass alongside the cleartexts.
 */
export async function buildDecryptionProof(
  kmsVerifierAddress: string,
  handles: string[],
  clearValues: bigint[],
): Promise<string> {
  if (handles.length !== clearValues.length) {
    throw new Error(`handles (${handles.length}) and clearValues (${clearValues.length}) must match`);
  }

  // Every FHE scalar is ABI-encoded as uint256 by the KMS. Note that Solidity's
  // `abi.encode(uint64)` produces the identical 32-byte word, which is why the contracts can
  // encode their native types directly.
  const abiTypes = handles.map(() => "uint256");
  const decryptedResult = ethers.AbiCoder.defaultAbiCoder().encode(abiTypes, clearValues);

  const domain = await readDomain(kmsVerifierAddress);
  const wallet = new ethers.Wallet(MOCK_KMS_SIGNER_PRIVATE_KEY);

  const signature = await wallet.signTypedData(domain, PUBLIC_DECRYPT_TYPES, {
    ctHandles: handles,
    decryptedResult,
    extraData: EXTRA_DATA,
  });

  return ethers.concat([
    ethers.solidityPacked(["uint8"], [1]), // one signer, threshold is 1
    ethers.solidityPacked(["bytes"], [signature]),
    EXTRA_DATA,
  ]);
}
