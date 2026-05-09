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

AI agents are becoming economic actors. They will buy APIs, inference, data, compute, SaaS — and pay each other. Today every agent transaction publishes its budget, its limits, its remaining runway, and its vendor list to the world. That is a strategy leak, a pricing-against-you problem, and a compliance non-starter.

**CipherAgent Pay** is the **encrypted treasury policy layer** for this new class of economic actor. Owners encrypt budgets, per-call caps, and lifetime spend limits in the browser. Agents transact under those rules without the contract or any observer ever learning the plaintext. Auditors decrypt only what they have been explicitly granted access to. The contract is intentionally token-agnostic — it composes above any payment rail.

This is privacy by **selective disclosure via ACL**, not anonymity.

## Why now

Confidential onchain finance is no longer a thesis. The Zama ecosystem already ships [confidential wallets](https://www.zama.org/ecosystem) (Bron), [private payments](https://www.zama.org/ecosystem) (Raycash, Zaïffer), [confidential auctions](https://www.zama.org/ecosystem) (deBerry's), [privacy-preserving portfolio management](https://www.zama.org/ecosystem) (Orion Finance), and [ERC-7984 confidential token explorers](https://www.zama.org/ecosystem) (Blockscout). Infrastructure partners — OpenZeppelin (ERC-7984 standardisation), Etherscan, Ledger, LayerZero, Fireblocks — make it institution-ready.

Tokens, wallets, and explorers cover the **asset** layer. CipherAgent Pay fills a different gap: the **policy** layer above them. A confidential transfer hides the amount, but the spending rule that authorised it — _"this agent may spend up to $50/call, up to $5,000/month, only with these merchants"_ — still lives in the open on most stacks. CipherAgent Pay encrypts that rule.

## What's novel

1. **Encrypted policy as a first-class primitive.** The wider Zama ecosystem encrypts assets, balances, and transfer amounts. CipherAgent Pay encrypts the *spending rule* itself — budget, per-call cap, total cap, running spend, approval boolean, per-merchant revenue. Every authorisation is computed homomorphically on ciphertext.
2. **Silent failure at the policy layer.** Over-limit attempts leave exactly the same on-chain footprint as approved payments thanks to `FHE.select(approved, …, untouched)` on every state slot. The balance leak that a plaintext `require(...)` would create is structurally eliminated.
3. **Per-handle ACL with automatic role detection.** The same UI serves owner, auditor, and merchant. The frontend reads on-chain metadata to determine which role(s) the connected wallet plays and only requests handles that role can decrypt. No partial leaks — an unauthorised wallet gets a clean refusal.
4. **Token-agnostic composability.** Zero token dependencies in v0.1. Today the policy gates an internal encrypted accounting unit; v0.3's `IConfidentialToken` adapter lets the same contract govern ERC-7984 cUSDC, native ETH, or any future confidential asset without redeployment.
5. **Encrypted treasury rotation.** `rotatePolicy` lets an owner reset budget cycles (monthly / quarterly) with fresh ciphertexts while preserving the merchant allowlist and auditor grant. Production CFO workflows, not just one-shot demos.
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
contracts/CipherAgentPay.sol      The policy layer (~250 LOC, 1 contract)
test/CipherAgentPay.ts            8 hardhat tests · FHEVM mock runtime
scripts/deploy.ts                 Sepolia deployment
frontend/                         React + Vite demo
├── src/App.tsx                   3-stage flow: Owner → Agent → Disclosure
├── src/styles.css                Editorial dark theme
└── src/cipherAgentPayAbi.ts      Typed ABI subset
hardhat.config.ts                 viaIR + Cancun EVM
```

That is the whole project. By design.

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
git clone <this-repo> cipher-agent-pay && cd cipher-agent-pay
npm install
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

## Frontend flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  HERO   Pay like a private CFO.                                  │
│         [ Connect Sepolia wallet ] [ Sepolia · Zama Relayer ]    │
├─────────────────────────────────────────────────────────────────┤
│  STATUS · monospace single line, green / orange dot              │
├─────────────────────────────────────────────────────────────────┤
│  01  Owner       │ Encrypt the spending policy.                  │
│  OWNER           │ agent · merchant · auditor · budget · caps    │
│                  │ [ Encrypt policy ] [ Pause / Resume ]         │
├──────────────────┼───────────────────────────────────────────────┤
│  02  Agent       │ Spend without revealing.                      │
│  AGENT           │ owner · encrypted amount                      │
│                  │ [ Submit encrypted payment ]                  │
├──────────────────┼───────────────────────────────────────────────┤
│  03  Disclosure  │ Decrypt only what your role allows.           │
│  DISCLOSURE      │ [ Decrypt my view ]                           │
│                  │ ┌──────────────────────────────────────────┐  │
│                  │ │ balance              488                 │  │
│                  │ │ total spent           12                 │  │
│                  │ │ last payment          12                 │  │
│                  │ │ last payment status   approved           │  │
│                  │ └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

The "Decrypt my view" button reads on-chain metadata, auto-detects the connected wallet's role (owner, auditor, merchant, or any combination), requests only the matching ciphertext handles, and signs an EIP-712 user-decryption envelope to the Zama relayer. A merchant connecting with the same UI sees only their own revenue. An unauthorised wallet receives a clean refusal — never a partial leak.

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

**What is not protected.** Participant addresses (required for any meaningful authorisation flow), transaction existence (events drive UX), the merchant allowlist (public policy gate), and the pause flag (owner metadata). These are deliberate design choices.

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

We will not ship a competing confidential token — that surface is well covered by ERC-7984 and the Zama ecosystem. We will not introduce a protocol fee. We will not add an upgradeable proxy. Each new release passes mock tests, on-chain integration smoke tests, and a documentation update before tagging.

## Bounty fit (Zama × OpenBuild)

- **A genuinely new privacy-finance use case.** Encrypting the *spending policy* of an autonomous AI agent — not the asset, not the wallet, not the transfer — is a category none of the existing Zama-ecosystem projects covers. Composes above any payment rail.
- **Compliance is a feature, not an afterthought.** Selective disclosure via per-handle ACL, first-class auditor role, indexed events for SOC 2 trail reconstruction, and a non-anonymous transaction model that fits FATF / GDPR controller-processor expectations.
- **Concrete deployment paths.** Four target users (asset manager research desks, DAO ops agents, regulated enterprise AI fleets, multi-tenant SaaS) with the same v0.1 contract. The roadmap from policy primitive → ERC-7984 adapter → enterprise CFO console is direct, not aspirational.
- **Correct and effective use of Zama tooling.** Eleven FHE primitives in active use (`fromExternal`, `asEuint64`, `asEbool`, `add`, `sub`, `ge`, `le`, `and`, `select`, `allow`, `allowThis`). Frontend uses real `@zama-fhe/relayer-sdk/web` — no mock paths. Tests verify behaviour by user-decrypting actual handles, not by checking function call success.
- **Mature engineering posture.** `viaIR` + Cancun EVM, custom errors, monotonic payment nonces, no admin keys / upgrade proxy / protocol fee, single-file contract, two production dependencies (`@fhevm/solidity`, `@openzeppelin/contracts`). 8 tests passing in ~600ms.
- **Developer experience designed for clarity.** One README, two languages, four-line quick start, three-stage UI, automatic role detection so a developer plays owner / agent / merchant from a single wallet. The whole repo can be read in an afternoon.

## License

[BSD-3-Clause-Clear](#) (root file). Permissive on purpose — any agent framework, open-source or commercial, can integrate without friction.

---

<div align="center">

_Privacy is necessary for an open society in the electronic age._  
— Eric Hughes, 1993

</div>
