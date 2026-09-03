import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { buildDecryptionProof } from "./helpers/decryption";

/**
 * Proves the self-relaying public decryption round trip works end to end in the Hardhat mock
 * environment, which is what `DrawEngine.submitTotal` and `submitWinner` depend on:
 *
 *   on-chain   FHE.makePubliclyDecryptable(handle)
 *   off-chain  publicDecrypt(handle) -> cleartext
 *   on-chain   FHE.checkSignatures(handles, abi.encode(cleartext), proof)
 */
describe("Self-relaying public decryption", function () {
  beforeEach(function () {
    if (!fhevm.isMock) {
      console.warn("This suite only runs against the FHEVM mock environment");
      this.skip();
    }
  });

  it("verifies a KMS proof over a publicly decryptable handle", async function () {
    const factory = await ethers.getContractFactory("DecryptProbe");
    const probe = await factory.deploy();
    await probe.waitForDeployment();

    const secret = 123_456_789n;
    await (await probe.seed(secret)).wait();

    const handle = await probe.handle();

    // Step 2: decrypt off-chain.
    const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);
    expect(clear).to.eq(secret);

    // Step 3: verify the KMS proof on-chain.
    const { KMSVerifierAddress } = await fhevm.getCoprocessorConfig(await probe.getAddress());
    const proof = await buildDecryptionProof(KMSVerifierAddress, [handle], [clear]);

    await (await probe.finalize(clear, proof)).wait();

    expect(await probe.verified()).to.eq(true);
    expect(await probe.revealed()).to.eq(secret);
  });

  it("rejects a proof that does not match the cleartext", async function () {
    const factory = await ethers.getContractFactory("DecryptProbe");
    const probe = await factory.deploy();
    await probe.waitForDeployment();

    await (await probe.seed(1000n)).wait();
    const handle = await probe.handle();
    const clear = await fhevm.publicDecryptEuint(FhevmType.euint64, handle);

    const { KMSVerifierAddress } = await fhevm.getCoprocessorConfig(await probe.getAddress());
    // Sign a different value than the one submitted.
    const proof = await buildDecryptionProof(KMSVerifierAddress, [handle], [clear + 1n]);

    await expect(probe.finalize(clear, proof)).to.be.reverted;
    expect(await probe.verified()).to.eq(false);
  });
});
