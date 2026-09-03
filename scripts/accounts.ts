import { ethers } from "hardhat";

/** Reports ETH and USDCMock balances for the first few accounts on the active network. */
const UNDERLYING = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";

async function main() {
  const signers = (await ethers.getSigners()).slice(0, 4);
  const net = await ethers.provider.getNetwork();
  const isSepolia = net.chainId === 11155111n;

  const erc20 = new ethers.Contract(
    UNDERLYING,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider,
  );

  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    const eth = await ethers.provider.getBalance(s.address);
    let usdc = "-";
    if (isSepolia) {
      usdc = ethers.formatUnits(await erc20.balanceOf(s.address), 6);
    }
    console.log(`[${i}] ${s.address}  ${ethers.formatEther(eth).padStart(22)} ETH   ${usdc} USDCMock`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
