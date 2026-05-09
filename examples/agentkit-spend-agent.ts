/**
 * Example: a minimal autonomous spending agent that uses CipherAgentPay
 * as its on-chain policy layer.
 *
 * Drop-in shape compatible with Coinbase AgentKit, LangGraph nodes, or any
 * runtime that gives you an ethers Signer. The agent receives a "spend
 * request" (intent), looks up the active policy, and submits the payment as
 * an encrypted transaction. It never holds the spending limits in memory —
 * the contract enforces them on ciphertext.
 *
 * Run:
 *   PRIVATE_KEY=0x... \
 *   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *   CIPHER_AGENT_PAY=0xfCAfBD34cE30c05502e6E2e9f4f1392c282d2441 \
 *   POLICY_OWNER=0xOwnerWalletThatCreatedTheStudioPolicy \
 *   npx tsx examples/agentkit-spend-agent.ts
 *
 * Note: this file is not part of the frontend build. It targets a Node
 * runtime (or any service that can hold a hot signer such as a Vault, KMS,
 * or AgentKit harness).
 */

import "dotenv/config";
import { JsonRpcProvider, Wallet, isAddress } from "ethers";

import { CipherAgentClient } from "../frontend/src/lib/cipher-agent-client";

type SpendIntent = {
  reason: string;
  vendor: string;
  amount: bigint;
};

const env = {
  rpc: required("SEPOLIA_RPC_URL"),
  privateKey: required("PRIVATE_KEY"),
  contract: required("CIPHER_AGENT_PAY"),
  owner: required("POLICY_OWNER"),
};

async function main() {
  if (!isAddress(env.contract)) throw new Error("CIPHER_AGENT_PAY is not a valid address");
  if (!isAddress(env.owner)) throw new Error("POLICY_OWNER is not a valid address");

  const provider = new JsonRpcProvider(env.rpc);
  const signer = new Wallet(env.privateKey, provider);
  const agentAddress = await signer.getAddress();

  console.log(`[agentkit] booting spend agent ${shortAddress(agentAddress)}`);

  const client = await CipherAgentClient.connect({
    contract: env.contract,
    signer,
  });

  const policy = await client.getPolicyState(env.owner);
  if (!policy.initialized) {
    throw new Error(`No CipherAgentPay policy found for owner ${env.owner}. Set one in the Studio.`);
  }
  if (policy.paused) {
    throw new Error("Policy is paused. Owner must resume before the agent can spend.");
  }
  if (policy.agent.toLowerCase() !== agentAddress.toLowerCase()) {
    throw new Error(
      `This wallet (${agentAddress}) is not the agent bound to the policy (${policy.agent}).`,
    );
  }

  const intents: SpendIntent[] = [
    { reason: "Renew weekly OpenAI credits", vendor: env.owner, amount: 12n },
    { reason: "Top up RPC quota at Alchemy", vendor: env.owner, amount: 8n },
    { reason: "Pay vendor invoice (small)", vendor: env.owner, amount: 25n },
  ];

  for (const intent of intents) {
    console.log(`\n[agentkit] intent: ${intent.reason} → ${intent.amount} units`);
    try {
      const txHash = await client.requestPayment({
        owner: env.owner,
        merchant: intent.vendor,
        amount: intent.amount,
      });
      console.log(`[agentkit] submitted encrypted payment · tx ${txHash}`);
      console.log(
        `[agentkit] explorer: https://sepolia.etherscan.io/tx/${txHash}`,
      );
    } catch (err) {
      console.error(`[agentkit] payment failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `\n[agentkit] done. Approved/blocked status is on ciphertext — open the Studio Disclosure tab to read it.`,
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
