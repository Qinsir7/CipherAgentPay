import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractFactory("CipherAgentPay");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log(`CipherAgentPay deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
