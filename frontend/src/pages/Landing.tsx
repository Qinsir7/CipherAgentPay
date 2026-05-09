import { Link } from "react-router-dom";

const contractAddress = (import.meta.env.VITE_CIPHER_AGENT_PAY_ADDRESS as string) ?? "";

const useCases = [
  {
    persona: "DAO Treasurer",
    title: "Governance-bounded autonomous spending.",
    body: "A DAO votes on a quarterly budget for an ops agent. Limits live on-chain as ciphertext — competitors can verify the agent is bounded without learning the cap.",
    metrics: ["Quarterly cap stays private", "Per-merchant allowlist", "Auditor seat for treasury committee"],
  },
  {
    persona: "AI Ops at a SaaS company",
    title: "Subscription auto-pay with hard ceilings.",
    body: "A LangGraph agent renews vendor subscriptions, books cloud capacity, and tops up API credits — never above the cap finance agreed to. Each charge is silently rejected if it would breach policy.",
    metrics: ["Per-payment cap", "Total monthly cap", "Pause kill-switch in one tx"],
  },
  {
    persona: "Trading Desk",
    title: "Encrypted budget for OTC settlement bots.",
    body: "Counterparties verify settlement happened. Strategy size, P&L, and inventory stay private. Auditor-only decryption supports compliance without market signaling.",
    metrics: ["Auditor-scoped reveal", "Merchant revenue isolation", "Per-counterparty allowlist"],
  },
  {
    persona: "Family Office",
    title: "Delegated allocations without leaking holdings.",
    body: "A wealth manager runs an allocation agent across whitelisted custodians. The owner can rotate policy weekly. Custodians decrypt only their own inflows.",
    metrics: ["Weekly policy rotation", "Custodian-scoped reveal", "Zero balance leakage"],
  },
];

const stack = [
  {
    layer: "Encrypted Policy",
    spec: "FHE budget · per-payment cap · total cap",
    body: "Owners commit limits as Zama euint64 ciphertexts. Even rotation keeps every subsequent cap encrypted end-to-end.",
  },
  {
    layer: "Confidential Treasury",
    spec: "fundAgent / euint64 balance",
    body: "Treasury balance and running total spent live as ciphertext. Homomorphic checks decide approval without ever decrypting.",
  },
  {
    layer: "Selective Disclosure",
    spec: "EIP-712 userDecrypt via Zama relayer",
    body: "Owner, auditor, and merchant each get a different decrypted view. The relayer enforces ACL boundaries on every signed request.",
  },
  {
    layer: "Audit Trail",
    spec: "PaymentEvaluated · PolicyRotated · PolicyPaused",
    body: "Every state change emits an indexed event. Regulators can prove what happened without seeing how much.",
  },
];

const steps = [
  {
    n: "01",
    title: "Encrypt policy",
    body: "Owner signs an encrypted commit: budget + per-payment cap + total cap. Agent and auditor are bound at the same time.",
  },
  {
    n: "02",
    title: "Fund treasury",
    body: "fundAgent moves encrypted balance into the contract. Even the deposit amount is FHE-encrypted in the browser before submission.",
  },
  {
    n: "03",
    title: "Agent spends",
    body: "Agent submits an encrypted amount. The contract evaluates ge / le / and over ciphertext, updates state on success, leaves it untouched on silent failure.",
  },
  {
    n: "04",
    title: "Selective reveal",
    body: "Owner sees balance and spend. Auditor sees the same. Merchant sees only its own revenue. Everyone else sees nothing on-chain.",
  },
];

const integrations = [
  { name: "MetaMask", note: "Browser wallet · userDecrypt signing" },
  { name: "LangGraph", note: "Drop-in Python / TS agent runtime" },
  { name: "AgentKit", note: "Coinbase autonomous agent SDK" },
  { name: "Hardhat", note: "FHEVM mock for local CI" },
  { name: "ERC-7984", note: "Composable with confidential cUSDC" },
  { name: "Etherscan", note: "Indexed PaymentEvaluated trail" },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">
            <span className="dot" /> Live on Sepolia · Powered by Zama FHEVM
          </p>
          <h1 className="hero__title">
            The encrypted policy layer<br />
            for autonomous agent treasuries.
          </h1>
          <p className="hero__lede">
            Give an AI agent a wallet without giving it a blank check. Budgets, per-payment caps,
            and totals stay encrypted on-chain. Approvals are computed on ciphertext. Only
            authorized roles ever decrypt.
          </p>
          <div className="hero__cta">
            <Link to="/app" className="btn btn--primary">
              Launch Studio
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/developers" className="btn btn--ghost">
              Read the SDK
            </Link>
          </div>
          {contractAddress && (
            <a
              className="hero__contract"
              href={`https://sepolia.etherscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="hero__contract-label">Sepolia contract</span>
              <code>{contractAddress}</code>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <div className="hero__grid" aria-hidden="true" />
      </section>

      <section className="trust">
        <div className="trust__inner">
          {[
            { value: "FHE", label: "Encrypted at rest, in motion, in compute" },
            { value: "EIP-712", label: "Per-role userDecrypt boundary" },
            { value: "0 leaks", label: "Silent failure on policy breach" },
            { value: "1-tx", label: "Pause kill-switch · policy rotation" },
          ].map((item) => (
            <div key={item.value} className="trust__item">
              <span className="trust__value">{item.value}</span>
              <span className="trust__label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="problem">
        <div className="section__head">
          <p className="kicker">The problem</p>
          <h2>AI agents are getting wallets faster than guardrails.</h2>
        </div>
        <div className="problem__grid">
          <article>
            <h3>Public limits are competitive intel</h3>
            <p>
              Putting an agent's monthly cap in plaintext on-chain hands competitors a roadmap.
              Vendors price against your ceiling. Counterparties read your strategy size.
            </p>
          </article>
          <article>
            <h3>Off-chain controls don't compose</h3>
            <p>
              Stripe-style allowlists sit outside the agent's wallet. The moment the agent talks
              to a smart contract, the guardrails disappear. There is no on-chain refusal.
            </p>
          </article>
          <article>
            <h3>"Just trust the agent" doesn't pass audit</h3>
            <p>
              Boards and regulators want a verifiable answer to <em>"who can stop it, and how
              fast?"</em> A README is not a control. A pause function is.
            </p>
          </article>
        </div>
      </section>

      <section id="architecture" className="architecture">
        <div className="section__head">
          <p className="kicker">Architecture</p>
          <h2>Four encrypted layers, one auditable trail.</h2>
          <p className="section__lede">
            CipherAgent Pay is a Solidity protocol on Zama FHEVM. Every limit is a ciphertext, every
            check is homomorphic, every reveal is signed by the role doing the revealing.
          </p>
        </div>
        <div className="stack">
          {stack.map((layer, i) => (
            <article key={layer.layer} className="stack__layer">
              <div className="stack__index">L{i + 1}</div>
              <div className="stack__copy">
                <h3>{layer.layer}</h3>
                <p className="stack__spec">{layer.spec}</p>
                <p className="stack__body">{layer.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how">
        <div className="section__head">
          <p className="kicker">How it works</p>
          <h2>Four steps from policy to selective reveal.</h2>
        </div>
        <div className="how__grid">
          {steps.map((step) => (
            <article key={step.n} className="how__step">
              <span className="how__num">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="use-cases" className="cases">
        <div className="section__head">
          <p className="kicker">Real scenarios</p>
          <h2>Built for the four people most exposed to AI agents in finance.</h2>
        </div>
        <div className="cases__grid">
          {useCases.map((c) => (
            <article key={c.persona} className="case">
              <p className="case__persona">{c.persona}</p>
              <h3>{c.title}</h3>
              <p className="case__body">{c.body}</p>
              <ul className="case__metrics">
                {c.metrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="dev-cta">
        <div className="dev-cta__copy">
          <p className="kicker">For builders</p>
          <h2>Wire CipherAgent Pay into any agent in 5 lines.</h2>
          <p>
            The SDK exposes <code>setPolicy</code>, <code>fund</code>, <code>requestPayment</code>,
            and <code>decryptMyView</code> — typed, awaitable, and Sepolia-ready out of the box.
          </p>
          <Link to="/developers" className="btn btn--primary">
            Open developer guide →
          </Link>
        </div>
        <pre className="dev-cta__code">
          <code>{`import { CipherAgentClient } from "cipher-agent-pay";

const client = await CipherAgentClient.connect({
  contract: "${contractAddress || "0x…"}",
  signer,
});

await client.requestPayment({
  owner: ownerAddress,
  merchant: vendorAddress,
  amount: 12n,
});`}</code>
        </pre>
      </section>

      <section className="ecosystem">
        <div className="section__head">
          <p className="kicker">Composability</p>
          <h2>Lives in the stack you already ship.</h2>
        </div>
        <ul className="ecosystem__grid">
          {integrations.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="closer">
        <div className="closer__inner">
          <h2>Ship the agent. Keep the keys.</h2>
          <p>
            Connect a Sepolia wallet and run an end-to-end encrypted policy in under two minutes.
          </p>
          <div className="closer__cta">
            <Link to="/app" className="btn btn--primary">
              Launch Studio
            </Link>
            <Link to="/developers" className="btn btn--ghost">
              SDK reference
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
