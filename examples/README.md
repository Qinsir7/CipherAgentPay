# Examples

End-to-end snippets that show CipherAgent Pay running outside of the Studio UI.
Each example uses the same `CipherAgentClient` exposed by the frontend
(`frontend/src/lib/cipher-agent-client.ts`), so what works here works inside an
AgentKit action, a LangGraph node, a Temporal worker, or a custom Node service.

---

## `agentkit-spend-agent.ts`

A minimal spending agent that pulls its policy from CipherAgent Pay before
acting. The agent never holds the budget in memory — every payment is
evaluated on ciphertext by the contract, so out-of-policy intents are rejected
silently on-chain.

### Run it

```bash
npm install dotenv tsx --save-dev   # one-time

PRIVATE_KEY=0xAgentWalletPrivateKey \
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
CIPHER_AGENT_PAY=0xfCAfBD34cE30c05502e6E2e9f4f1392c282d2441 \
POLICY_OWNER=0xOwnerThatCreatedThePolicyInTheStudio \
npx tsx examples/agentkit-spend-agent.ts
```

### What it does

1. Connects an ethers Wallet (the agent's hot key).
2. Reads the active policy from CipherAgentPay and asserts:
   - the policy is initialized,
   - the policy is not paused,
   - this wallet is the bound agent.
3. Iterates a small list of synthetic spending intents and submits each as an
   encrypted `requestPayment`.
4. Prints Etherscan links for every submitted transaction.

### Wiring into a real runtime

The same code path drops into:

- **AgentKit (Coinbase)**: replace `intents` with the LLM's tool-call output,
  expose `requestPayment` as a registered AgentKit action.
- **LangGraph**: instantiate `CipherAgentClient` once in the graph state,
  invoke `requestPayment` from a `Tool` node.
- **Temporal / queue worker**: run as a worker that consumes spend-request
  messages from a queue and submits encrypted payments.

The contract enforces budget, per-payment cap, total cap, merchant allowlist,
and pause state on every call — your agent code stays small and oblivious to
the actual amounts.
