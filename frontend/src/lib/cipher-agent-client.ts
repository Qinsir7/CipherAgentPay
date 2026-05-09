/**
 * CipherAgentClient
 *
 * Minimal TypeScript client wrapping the CipherAgent Pay protocol so that any
 * AI agent (LangGraph, AgentKit, custom Node service) can wire encrypted
 * payments in a few lines.
 *
 * The same code paths the Studio uses, packaged for headless reuse.
 */

import { createInstance, initSDK, SepoliaConfig, type FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { Contract, hexlify, isAddress, type Signer } from "ethers";

import { cipherAgentPayAbi } from "../cipherAgentPayAbi";

export type CipherAgentClientOptions = {
  /** Address of the deployed CipherAgentPay contract */
  contract: string;
  /** Connected ethers signer (browser wallet, Vault, KMS, etc.) */
  signer: Signer;
};

export type EncryptedPolicy = {
  budget: bigint;
  perPaymentLimit: bigint;
  totalSpendLimit: bigint;
};

export type PolicyState = {
  agent: string;
  auditor: string;
  initialized: boolean;
  paused: boolean;
};

export type DecryptedView = Partial<{
  balance: bigint;
  totalSpent: bigint;
  lastPaymentAmount: bigint;
  lastPaymentApproved: boolean;
  merchantRevenue: bigint;
}>;

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class CipherAgentClient {
  private constructor(
    private readonly contract: Contract,
    private readonly contractAddress: string,
    private readonly signer: Signer,
    private readonly fhevm: FhevmInstance,
  ) {}

  /** Bootstraps the Zama relayer SDK and returns a ready client. */
  static async connect(options: CipherAgentClientOptions): Promise<CipherAgentClient> {
    if (!isAddress(options.contract)) {
      throw new Error("CipherAgentClient: invalid contract address.");
    }

    await initSDK();
    const provider = options.signer.provider;
    if (!provider) {
      throw new Error("CipherAgentClient: signer must be connected to a provider.");
    }

    const fhevm = await createInstance({
      ...SepoliaConfig,
      network: (provider as unknown) as Parameters<typeof createInstance>[0]["network"],
    });

    const contract = new Contract(options.contract, cipherAgentPayAbi, options.signer);
    return new CipherAgentClient(contract, options.contract, options.signer, fhevm);
  }

  /**
   * Owner: commit a fresh encrypted policy. If a policy already exists for the
   * caller, this rotates it (running totals reset, merchants preserved).
   */
  async setPolicy(params: {
    agent: string;
    initialMerchant: string;
    policy: EncryptedPolicy;
  }): Promise<string> {
    const ownerAddress = await this.signer.getAddress();
    const { handles, inputProof } = await this.encryptPolicy(ownerAddress, params.policy);

    const [, , initialized] = await this.contract.getAgent(ownerAddress);
    const tx = initialized
      ? await this.contract.rotatePolicy(
          params.agent,
          hexlify(handles[0]),
          hexlify(handles[1]),
          hexlify(handles[2]),
          hexlify(inputProof),
        )
      : await this.contract.createAgent(
          params.agent,
          params.initialMerchant,
          hexlify(handles[0]),
          hexlify(handles[1]),
          hexlify(handles[2]),
          hexlify(inputProof),
        );
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  /** Owner: top up the encrypted treasury. */
  async fund(amount: bigint): Promise<string> {
    const ownerAddress = await this.signer.getAddress();
    const input = this.fhevm.createEncryptedInput(this.contractAddress, ownerAddress);
    input.add64(amount);
    const encrypted = await input.encrypt();
    const tx = await this.contract.fundAgent(hexlify(encrypted.handles[0]), hexlify(encrypted.inputProof));
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  /** Owner: pause or resume the policy. Agent payments revert while paused. */
  async setPaused(paused: boolean): Promise<string> {
    const tx = await this.contract.pausePolicy(paused);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  /** Owner: add or remove a merchant from the allowlist. */
  async setMerchant(merchant: string, allowed: boolean): Promise<string> {
    const tx = await this.contract.setMerchant(merchant, allowed);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  /** Agent: submit an encrypted payment against the owner's policy. */
  async requestPayment(params: {
    owner: string;
    merchant: string;
    amount: bigint;
  }): Promise<string> {
    const agentAddress = await this.signer.getAddress();
    const input = this.fhevm.createEncryptedInput(this.contractAddress, agentAddress);
    input.add64(params.amount);
    const encrypted = await input.encrypt();
    const tx = await this.contract.requestPayment(
      params.owner,
      params.merchant,
      hexlify(encrypted.handles[0]),
      hexlify(encrypted.inputProof),
    );
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  /** Read the public policy metadata for a given owner. */
  async getPolicyState(owner: string): Promise<PolicyState> {
    const [agent, auditor, initialized, paused] = await this.contract.getAgent(owner);
    return { agent, auditor, initialized, paused };
  }

  /**
   * Selectively decrypt the ciphertext fields the connected signer is allowed
   * to read. Returns only the fields covered by the caller's role.
   */
  async decryptMyView(params: { owner: string; merchant?: string }): Promise<DecryptedView> {
    const signerAddress = await this.signer.getAddress();
    const [, auditor] = await this.contract.getAgent(params.owner);

    const signerLower = signerAddress.toLowerCase();
    const ownerLower = params.owner.toLowerCase();
    const auditorLower = auditor === ZERO_ADDRESS ? "" : auditor.toLowerCase();
    const merchantLower = params.merchant && isAddress(params.merchant) ? params.merchant.toLowerCase() : "";

    const isOwner = signerLower === ownerLower;
    const isAuditor = auditorLower !== "" && signerLower === auditorLower;
    const isMerchant = merchantLower !== "" && signerLower === merchantLower;

    const handlesByName: Record<string, string> = {};
    if (isOwner || isAuditor) {
      handlesByName.balance = await this.contract.encryptedBalance(params.owner);
      handlesByName.totalSpent = await this.contract.encryptedTotalSpent(params.owner);
      handlesByName.lastPaymentAmount = await this.contract.encryptedLastPaymentAmount(params.owner);
      handlesByName.lastPaymentApproved = await this.contract.encryptedLastPaymentApproved(params.owner);
    }
    if (isMerchant && params.merchant) {
      handlesByName.merchantRevenue = await this.contract.encryptedMerchantRevenue(params.merchant);
    }

    const handles = Object.values(handlesByName).filter((handle) => handle !== ZERO_HANDLE);
    if (handles.length === 0) {
      return {};
    }

    const keypair = this.fhevm.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 10;
    const contractAddresses = [this.contractAddress];
    const eip712 = this.fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
    const signature = await this.signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: [...eip712.types.UserDecryptRequestVerification] },
      eip712.message,
    );

    const decrypted = await this.fhevm.userDecrypt(
      handles.map((handle) => ({ handle, contractAddress: this.contractAddress })),
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      signerAddress,
      startTimestamp,
      durationDays,
    );

    const view: DecryptedView = {};
    for (const [name, handle] of Object.entries(handlesByName)) {
      const value = decrypted[handle as `0x${string}`];
      if (value === undefined) continue;
      if (name === "lastPaymentApproved") {
        view.lastPaymentApproved = Boolean(value);
      } else if (typeof value === "bigint") {
        (view as Record<string, bigint>)[name] = value;
      }
    }
    return view;
  }

  private async encryptPolicy(ownerAddress: string, policy: EncryptedPolicy) {
    const input = this.fhevm.createEncryptedInput(this.contractAddress, ownerAddress);
    input.add64(policy.budget);
    input.add64(policy.perPaymentLimit);
    input.add64(policy.totalSpendLimit);
    return input.encrypt();
  }
}
