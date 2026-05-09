<div align="center">

# CipherAgent Pay

**The encrypted policy layer for autonomous AI agent treasuries.**

Built on [Zama Protocol](https://www.zama.ai) FHEVM. Live on Ethereum Sepolia.

[English](./README.md) · [中文](./README.zh-CN.md)

> _"Privacy is the power to selectively reveal oneself to the world."_  
> — Eric Hughes, _A Cypherpunk's Manifesto_, 1993

</div>

---

## Overview

AI agents are starting to spend money. They buy inference, data, RPC, SaaS, and they will pay each other. The natural thing to do today is hand the agent a hot wallet and a budget — at which point the budget, the running balance, and the vendor list become public. Competitors learn the burn rate. Vendors price against the cap. Compliance can't sign off.

**CipherAgent Pay** is the encrypted treasury policy layer for this new class of economic actor. The owner encrypts a budget, a per-call cap, and a lifetime spend limit in the browser. The agent transacts under those rules without the contract or any observer ever learning the plaintext. Auditors decrypt only what they have been explicitly granted. The contract is token-agnostic — it sits above any payment rail.

This is privacy by **selective disclosure via ACL**, not anonymity.

## Why now

Confidential onchain finance is no longer a thesis. The Zama ecosystem already ships confidential wallets ([Bron](https://bron.org/)), private payment accounts ([Raycash](https://www.raycash.xyz/), [Zaïffer](https://www.zaiffer.org/)), sealed-bid auctions ([deBerry's](https://deberrys.xyz/)), privacy-preserving portfolio management ([Orion Finance](https://www.orionfinance.ai/)), and [ERC-7984 explorer support](https://www.blog.blockscout.com/zama-confidential-tokens-block-explorer/) (Blockscout). Infrastructure partners — OpenZeppelin (ERC-7984 standardisation), Etherscan, Ledger, LayerZero, Fireblocks — make it institution-ready.

Wallets, tokens, and explorers cover the **asset** layer. CipherAgent Pay fills a different gap: the **policy** layer above them. A confidential transfer hides the amount, but the rule that authorised it — _"this agent may spend up to $50/call, up to $5,000/month, only with these merchants"_ — still lives in the open on most stacks. CipherAgent Pay encrypts that rule.

## What's novel

1. **Encrypted policy as a first-class primitive.** The wider Zama ecosystem encrypts assets, balances, and transfer amounts. CipherAgent Pay encrypts the *spending rule* itself — budget, per-call cap, total cap, running spend, approval boolean, per-merchant revenue. Every authorisation is computed homomorphically on ciphertext.
2. **Silent failure at the policy layer.** Over-limit attempts leave exactly the same on-chain footprint as approved payments thanks to `FHE.select(approved, …, untouched)` on every state slot. The balance leak that a plaintext `require(...)` would create is structurally eliminated.
3. **Per-handle ACL with automatic role detection.** The same UI serves owner, auditor, and merchant. The frontend reads on-chain metadata to determine which role(s) the connected wallet plays and only requests handles that role can decrypt. No partial leaks — an unauthorised wallet gets a clean refusal.
4. **Token-agnostic composability.** Zero token dependencies in v0.1. Today the policy gates an internal encrypted accounting unit; v0.3's `IConfidentialToken` adapter lets the same contract govern ERC-7984 cUSDC, native ETH, or any future confidential asset without redeployment.
5. **Encrypted treasury rotation.** `rotatePolicy` lets an owner reset budget cycles (monthly / quarterly) with fresh ciphertexts while preserving the merchant allowlist and auditor grant — so a real CFO workflow doesn't break on cycle boundaries.
6. **Per-merchant encrypted revenue.** Each vendor decrypts only their own cumulative revenue handle. The owner sees the full breakdown. No two vendors can correlate.

## Real-world scenarios

These are the four target users we designed against. Each is concrete, regulated, and on the table once an owner can publish encrypted spending rules.

> **AI research desk at an asset manager.** A fund deploys autonomous analyst-agents that subscribe to Bloomberg, Kaiko, alt-data feeds, and inference APIs. Each agent gets an encrypted $5,000/month budget under a single policy. Competitors watching the chain see neither the burn rate nor which datasets the fund is buying. Internal compliance decrypts the audit view monthly via the auditor ACL grant.

> **DAO-controlled autonomous grant disbursement.** A DAO authorises an "ops agent" with an encrypted quarterly cap to pay contractors and infra providers. Treasury size, runway, and contractor list stay private from sybil-attackers and forks. The DAO's elected auditor decrypts totals on demand; multisig signers can pause and rotate the policy if the agent misbehaves.

> **Enterprise AI agent fleet under SOX / GDPR.** A bank or healthcare org gives each internal AI assistant a per-call encrypted spend cap and a monthly cap. Internal audit gets first-class auditor decrypt access — satisfying the controller-processor model regulators expect. External vendors decrypt only their own revenue. No cross-vendor correlation, no plaintext budget on chain, no off-chain shadow ledger to reconcile.

> **Multi-tenant SaaS with per-tenant agent budgets.** A SaaS provider gives every customer's AI assistant its own encrypted spending policy. Each tenant decrypts their own balance and spend. The SaaS provider acts as auditor for incident response. No tenant can infer another's usage from chain data — privacy as the SaaS multi-tenancy guarantee, enforced by FHE rather than by trust.

## What CipherAgent Pay does

```text
              Owner (CFO / DAO / human-in-the-loop)
                            │
                            │  encrypts in browser
                            ▼
                     CipherAgent Pay
            ┌──────────────────────────────────┐
            │  euint64 budget                  │
            │  euint64 perPaymentLimit         │
            │  euint64 totalSpendLimit         │
            │  euint64 totalSpent              │
            │  ebool   lastPaymentApproved     │
            │  ACL grants → owner / auditor /  │
            │               merchant           │
            └──────────────────────────────────┘
                            │
                            │  homomorphic predicate
                            ▼
                Approved or blocked  →  payment rail
                (native ETH today, ERC-7984 tomorrow)
                            │
                            ▼
                       Zama FHEVM
```

The owner publishes a confidential policy in one transaction. Each agent payment is evaluated as `balance ≥ amount` ∧ `amount ≤ perTxCap` ∧ `spent + amount ≤ totalCap`, all on ciphertext. State updates only when the encrypted predicate is true; otherwise the on-chain footprint is identical to a successful run, preserving balance privacy.

## What is encrypted

| Datum                      | Type      | Visible to (after ACL grant)                  |
| -------------------------- | --------- | --------------------------------------------- |
| Initial budget             | `euint64` | Owner, optional Auditor                       |
| Per-payment limit          | `euint64` | Owner, optional Auditor                       |
| Total spend limit          | `euint64` | Owner, optional Auditor                       |
| Total spent (running)      | `euint64` | Owner, optional Auditor                       |
| Last payment amount        | `euint64` | Owner, optional Auditor                       |
| Last payment approval      | `ebool`   | Owner, optional Auditor                       |
| Per-merchant revenue       | `euint64` | Merchant (own only), Owner, optional Auditor  |
| Merchant allowlist         | `bool`    | Public — policy gate, by design               |
| Pause flag                 | `bool`    | Public — owner-controlled metadata            |
| Owner / agent / auditor    | `address` | Public                                        |

Each new ciphertext handle (Zama returns a fresh handle on every state write) is granted explicitly via `FHE.allow(handle, addr)`. A merchant is never granted access to the owner's balance; another merchant's revenue is never reachable from the first merchant's wallet.

## How it works (the predicate, in plain Solidity)

```solidity
ebool hasBalance         = FHE.ge(account.balance, encryptedAmount);
ebool underPerPaymentCap = FHE.le(encryptedAmount, account.perPaymentLimit);
ebool underTotalCap      = FHE.le(nextSpent, account.totalSpendLimit);
ebool approved           = FHE.and(FHE.and(hasBalance, underPerPaymentCap), underTotalCap);

account.balance              = FHE.select(approved, FHE.sub(account.balance, encryptedAmount), account.balance);
account.totalSpent           = FHE.select(approved, nextSpent, account.totalSpent);
account.lastPaymentAmount    = FHE.select(approved, encryptedAmount, FHE.asEuint64(0));
account.lastPaymentApproved  = approved;
```

Zero plaintext is ever exposed. The "silent failure" pattern — `FHE.select(approved, …, untouched)` for every slot — means an over-limit payment leaves the same on-chain shape as an approved one. Only addresses on the per-handle ACL learn the outcome.

## Repository

```text
contracts/CipherAgentPay.sol            The policy layer (~330 LOC, 1 contract)
test/CipherAgentPay.ts                  8 hardhat tests · FHEVM mock runtime
scripts/deploy.ts                       Sepolia deployment
frontend/                               React 19 + Vite multi-page product
├── src/main.tsx                        React Router routes
├── src/App.tsx                         Layout shell (Nav + Outlet + Footer)
├── src/components/Nav.tsx              Top navigation
├── src/components/Footer.tsx           Footer
├── src/pages/Landing.tsx               Marketing page (hero / why / how / cases / dev CTA)
├── src/pages/Studio.tsx                Dashboard with role tabs (owner / agent / disclosure)
├── src/pages/Explorer.tsx              Live on-chain activity feed (queryFilter on Sepolia)
├── src/pages/Developers.tsx            SDK guide with sticky-nav docs
├── src/lib/cipher-agent-client.ts      Reusable TypeScript SDK
├── src/cipherAgentPayAbi.ts            Typed ABI subset
└── src/styles.css                      Editorial dark theme · Instrument Serif display
examples/agentkit-spend-agent.ts        Headless Node agent using the SDK
hardhat.config.ts                       viaIR + Cancun EVM
vercel.json                             SPA deployment + COOP/COEP headers
```

That is the whole project.

## Contract surface

`contracts/CipherAgentPay.sol` (Solidity 0.8.24, `viaIR`, Cancun EVM, custom errors).

| Function                                                                                      | Caller   | Effect                                                                                                   |
| --------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `createAgent(agent, merchant, eBudget, ePerTx, eTotal, proof)`                                 | Owner    | Initialise the encrypted policy. One-time per owner. Emits `PolicyCreated`.                              |
| `rotatePolicy(agent, eBudget, ePerTx, eTotal, proof)`                                          | Owner    | Replace ciphertexts. Resets running totals. Preserves merchant allowlist + auditor. Emits `PolicyRotated`. |
| `fundAgent(eAmount, proof)`                                                                    | Owner    | Top up encrypted balance and total-spend cap atomically.                                                 |
| `pausePolicy(bool)`                                                                            | Owner    | Owner-side kill switch. While paused, `requestPayment` reverts with `PolicyIsPaused`.                    |
| `setMerchant(merchant, allowed)`                                                               | Owner    | Toggle a merchant in / out of the allowlist (public policy gate).                                        |
| `setAuditor(auditor)`                                                                          | Owner    | Grant or revoke an auditor's selective decrypt rights.                                                   |
| `requestPayment(owner, merchant, eAmount, proof)`                                              | Agent    | Submit an encrypted payment. Approval is computed homomorphically. State updates only when `ebool` is true. |
| `getAgent(owner)` / `paymentNonce(owner)` / `allowedMerchant(owner, merchant)`                 | anyone   | Public policy metadata for indexers and the UI.                                                          |
| `encryptedBalance / PerPaymentLimit / TotalSpendLimit / TotalSpent / LastPaymentAmount / LastPaymentApproved / MerchantRevenue` | anyone | Returns ciphertext handles. Plaintext is inaccessible without an ACL grant. |

Custom errors: `InvalidAgent`, `PolicyAlreadyInitialized`, `PolicyNotInitialized`, `MerchantNotAllowed`, `NotAgent`, `PolicyIsPaused`.

Events: `PolicyCreated`, `PolicyRotated`, `PolicyPaused`, `MerchantUpdated`, `AuditorUpdated`, `PaymentEvaluated`, `TreasuryFunded`. All include indexed fields so a subgraph can stream them directly.

## Quick start

Requires Node.js 20 LTS (Hardhat 2 does not support odd-numbered Node releases).

```sh
git clone https://github.com/Qinsir7/CipherAgentPay && cd CipherAgentPay
npm install --legacy-peer-deps
npm run compile
npm test            # 8 tests · FHEVM mock runtime · ~600ms
```

Run the dApp against an already-deployed contract:

```sh
VITE_CIPHER_AGENT_PAY_ADDRESS=0xYourSepoliaContract npm run frontend:dev
```

Deploy your own to Sepolia (the deployer needs Sepolia ETH for gas):

```sh
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
npm run deploy:sepolia
```

## Frontend

The product surface is a four-page React app:

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing — hero with animated cipher mark, problem framing, three-step flow, four target personas, SDK preview |
| `/app` | Studio dashboard — KPI strip + role tabs (Owner / Agent / Disclosure) on top of one connected wallet |
| `/explorer` | Live on-chain trail — queries Sepolia events (`PolicyCreated`, `PaymentEvaluated`, `PolicyRotated`, `PolicyPaused`, `MerchantUpdated`, `TreasuryFunded`) with one click |
| `/developers` | SDK guide — install, connect, set policy, fund, request payment, decrypt scoped view, indexed events |

Studio's "Decrypt my view" reads on-chain metadata, auto-detects the connected wallet's role (owner, auditor, merchant, or any combination), requests only the matching ciphertext handles, and signs an EIP-712 user-decryption envelope to the Zama relayer. A merchant connecting with the same UI sees only their own revenue. An unauthorised wallet receives a clean refusal — never a partial leak.

Explorer streams the public, plaintext-safe events emitted by the contract — none of them leak amounts. The same data feeds a Datadog dashboard, a Graph subgraph, or a SOC 2 audit log without further work.

## Tests

```sh
npm test
```

Each assertion is made against actual `userDecryptEuint` / `userDecryptEbool` outputs — proving the ACL grants are correctly attached at every state transition, not just that the function ran.

| # | Scenario                                                                  |
| - | ------------------------------------------------------------------------- |
| 1 | Approved payment exposes ACL-gated views to owner, auditor, merchant.    |
| 2 | Over-limit payment silently fails — encrypted balance untouched.         |
| 3 | Multiple consecutive payments accumulate encrypted spend correctly.      |
| 4 | Paused policy reverts agent payment; resume restores live behaviour.     |
| 5 | Off-allowlist merchant is rejected with `MerchantNotAllowed`.            |
| 6 | `rotatePolicy` resets totals and preserves merchant + auditor state.     |
| 7 | `createAgent` rejects double-init with `PolicyAlreadyInitialized`.       |
| 8 | `fundAgent` increases encrypted balance and total-spend cap together.    |

## Compliance & security

**Compliance posture.** CipherAgent Pay is **privacy by selective disclosure, not anonymity** — a deliberate posture for institutional users.

- Participant addresses (owner, agent, auditor, merchant) are public. Counterparty attribution and the FATF Travel Rule's non-anonymous-transaction principle are honoured.
- An auditor role is built into the ACL primitive itself, not bolted on. The owner explicitly grants and revokes — matching the GDPR controller / processor model expected by regulators.
- Per-merchant encrypted revenue gives each vendor a privacy-preserving "what did I earn through this principal" view, suitable for VAT / sales-tax reconciliation without exposing aggregate buyer data.
- All state changes emit indexed events (`PolicyCreated`, `PolicyRotated`, `PolicyPaused`, `PaymentEvaluated`, …) so a SOC 2 audit trail can be reconstructed off-chain without ever decrypting amounts.
- Owners pause and rotate their own policy; there is no global pause or admin escape. Sovereignty stays with the principal — important for trust boundaries between integrators.

**Trust assumptions.** The owner is sovereign over their own policy. There is **no admin key, no upgrade key, no protocol fee**, and no global emergency stop. The contract has no external calls in v0.1, eliminating reentrancy surface. All FHE operations and ACL grants go through a single `_writePolicy` / `_allowAccountDecryptions` pair, so create and rotate paths cannot diverge.

**What is protected.** Payment amounts, balances, limits, totals, approval booleans, and per-merchant revenue. All `euint64` / `ebool`. Plaintext is reachable only by an address holding an explicit `FHE.allow` grant on the specific ciphertext handle.

**What is not protected.** Participant addresses (any meaningful authorisation flow needs them), transaction existence (events drive UX), the merchant allowlist (a public policy gate), and the pause flag (owner metadata). These are choices, not gaps.

**Key threat mitigations.**

- A compromised agent key cannot exceed the encrypted per-payment cap or total cap; the owner can `pausePolicy` and `rotatePolicy` immediately.
- A vendor cannot read the owner's overall balance, nor any other merchant's revenue.
- Cross-network ciphertext replay fails proof verification by Zama instance configuration.
- Auditor revocation (`setAuditor(0x0)`) affects future writes; rotate the policy after revocation if past handles must become orphaned.

The full ACL-grant matrix is encoded in `_allowAccountDecryptions` — if an entry is missing there, the corresponding handle is unreadable to that party.

## Roadmap

```
v0.1  ✓  Encrypted policy layer · Sepolia · 8 tests · React demo  (this release)
v0.2     Multi-agent per policy · per-merchant encrypted caps · The Graph subgraph
v0.3     ERC-7984 token adapter · settleEncrypted() · TypeScript SDK
v0.4     Multi-chain (Base, Arbitrum) · enterprise CFO console · Gnosis Safe friendly
v1.0     Mainnet · third-party audit · production SDK
```

Out of scope on purpose: a competing confidential token (ERC-7984 covers it), a protocol fee, an upgradeable proxy, a global admin key. Releases ship after the mock test suite passes, an on-chain smoke test on Sepolia succeeds, and the docs are updated.

## License

[MIT](./LICENSE) for the repository. Use it commercially, fork it, embed it. The Solidity files keep their `BSD-3-Clause-Clear` SPDX headers because they import Zama's FHEVM library, which requires it.
