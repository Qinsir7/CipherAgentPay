import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

describe("CipherAgentPay", function () {
  async function deployFixture() {
    if (!hre.fhevm.isMock) {
      throw new Error("CipherAgentPay tests are intended for the local FHEVM mock runtime");
    }

    const [owner, agent, merchant, auditor, blockedMerchant, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CipherAgentPay");
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    return { owner, agent, merchant, auditor, blockedMerchant, stranger, contract, contractAddress };
  }

  async function encryptPolicy(
    contractAddress: string,
    sender: string,
    budget: number,
    perPayment: number,
    total: number,
  ) {
    const input = hre.fhevm.createEncryptedInput(contractAddress, sender);
    input.add64(budget);
    input.add64(perPayment);
    input.add64(total);
    return input.encrypt();
  }

  async function encryptAmount(contractAddress: string, sender: string, amount: number) {
    const input = hre.fhevm.createEncryptedInput(contractAddress, sender);
    input.add64(amount);
    return input.encrypt();
  }

  it("approves a payment and exposes ACL-gated views to owner, auditor, and merchant", async function () {
    const { owner, agent, merchant, auditor, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 500, 50, 500);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    await contract.connect(owner).setAuditor(auditor.address);

    const payment = await encryptAmount(contractAddress, agent.address, 12);
    await contract
      .connect(agent)
      .requestPayment(owner.address, merchant.address, payment.handles[0], payment.inputProof);

    const balance = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedBalance(owner.address),
      contractAddress,
      owner,
    );
    const totalSpent = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedTotalSpent(owner.address),
      contractAddress,
      auditor,
    );
    const approved = await hre.fhevm.userDecryptEbool(
      await contract.encryptedLastPaymentApproved(owner.address),
      contractAddress,
      auditor,
    );
    const revenue = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedMerchantRevenue(merchant.address),
      contractAddress,
      merchant,
    );

    expect(Number(balance)).to.equal(488);
    expect(Number(totalSpent)).to.equal(12);
    expect(approved).to.equal(true);
    expect(Number(revenue)).to.equal(12);

    expect(await contract.paymentNonce(owner.address)).to.equal(1n);
  });

  it("silently fails an over-limit payment without leaking balance information", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 100, 20, 100);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    const payment = await encryptAmount(contractAddress, agent.address, 25);
    await contract
      .connect(agent)
      .requestPayment(owner.address, merchant.address, payment.handles[0], payment.inputProof);

    const balance = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedBalance(owner.address),
      contractAddress,
      owner,
    );
    const approved = await hre.fhevm.userDecryptEbool(
      await contract.encryptedLastPaymentApproved(owner.address),
      contractAddress,
      owner,
    );

    expect(Number(balance)).to.equal(100);
    expect(approved).to.equal(false);
  });

  it("accumulates encrypted spend across multiple approved payments", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 1000, 100, 1000);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    for (const amount of [25, 40, 30]) {
      const payment = await encryptAmount(contractAddress, agent.address, amount);
      await contract
        .connect(agent)
        .requestPayment(owner.address, merchant.address, payment.handles[0], payment.inputProof);
    }

    const totalSpent = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedTotalSpent(owner.address),
      contractAddress,
      owner,
    );
    const balance = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedBalance(owner.address),
      contractAddress,
      owner,
    );

    expect(Number(totalSpent)).to.equal(95);
    expect(Number(balance)).to.equal(905);
    expect(await contract.paymentNonce(owner.address)).to.equal(3n);
  });

  it("blocks requestPayment when policy is paused", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 500, 50, 500);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    await contract.connect(owner).pausePolicy(true);

    const payment = await encryptAmount(contractAddress, agent.address, 5);
    await expect(
      contract
        .connect(agent)
        .requestPayment(owner.address, merchant.address, payment.handles[0], payment.inputProof),
    ).to.be.revertedWithCustomError(contract, "PolicyIsPaused");

    await contract.connect(owner).pausePolicy(false);
    const payment2 = await encryptAmount(contractAddress, agent.address, 5);
    await contract
      .connect(agent)
      .requestPayment(owner.address, merchant.address, payment2.handles[0], payment2.inputProof);

    const totalSpent = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedTotalSpent(owner.address),
      contractAddress,
      owner,
    );
    expect(Number(totalSpent)).to.equal(5);
  });

  it("rejects payment to a merchant that is not on the allowlist", async function () {
    const { owner, agent, merchant, blockedMerchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 200, 50, 200);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    const payment = await encryptAmount(contractAddress, agent.address, 10);
    await expect(
      contract
        .connect(agent)
        .requestPayment(owner.address, blockedMerchant.address, payment.handles[0], payment.inputProof),
    ).to.be.revertedWithCustomError(contract, "MerchantNotAllowed");
  });

  it("rotates the policy and resets running totals while preserving merchant allowlist", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 100, 50, 100);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    const payment = await encryptAmount(contractAddress, agent.address, 30);
    await contract
      .connect(agent)
      .requestPayment(owner.address, merchant.address, payment.handles[0], payment.inputProof);

    const newPolicy = await encryptPolicy(contractAddress, owner.address, 1000, 200, 1000);
    await contract
      .connect(owner)
      .rotatePolicy(
        agent.address,
        newPolicy.handles[0],
        newPolicy.handles[1],
        newPolicy.handles[2],
        newPolicy.inputProof,
      );

    const balance = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedBalance(owner.address),
      contractAddress,
      owner,
    );
    const totalSpent = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedTotalSpent(owner.address),
      contractAddress,
      owner,
    );

    expect(Number(balance)).to.equal(1000);
    expect(Number(totalSpent)).to.equal(0);
    expect(await contract.allowedMerchant(owner.address, merchant.address)).to.equal(true);
  });

  it("blocks createAgent from re-initializing without rotation", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 100, 50, 100);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    const policy2 = await encryptPolicy(contractAddress, owner.address, 200, 60, 200);
    await expect(
      contract
        .connect(owner)
        .createAgent(
          agent.address,
          merchant.address,
          policy2.handles[0],
          policy2.handles[1],
          policy2.handles[2],
          policy2.inputProof,
        ),
    ).to.be.revertedWithCustomError(contract, "PolicyAlreadyInitialized");
  });

  it("tops up the encrypted balance via fundAgent", async function () {
    const { owner, agent, merchant, contract, contractAddress } = await deployFixture();

    const policy = await encryptPolicy(contractAddress, owner.address, 100, 50, 100);
    await contract
      .connect(owner)
      .createAgent(
        agent.address,
        merchant.address,
        policy.handles[0],
        policy.handles[1],
        policy.handles[2],
        policy.inputProof,
      );

    const topUp = await encryptAmount(contractAddress, owner.address, 250);
    await contract.connect(owner).fundAgent(topUp.handles[0], topUp.inputProof);

    const balance = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedBalance(owner.address),
      contractAddress,
      owner,
    );
    const totalLimit = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      await contract.encryptedTotalSpendLimit(owner.address),
      contractAddress,
      owner,
    );

    expect(Number(balance)).to.equal(350);
    expect(Number(totalLimit)).to.equal(350);
  });
});
