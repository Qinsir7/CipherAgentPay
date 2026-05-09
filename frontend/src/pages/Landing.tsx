import { Link } from "react-router-dom";

const contractAddress = (import.meta.env.VITE_CIPHER_AGENT_PAY_ADDRESS as string) ?? "";

const useCases = [
  {
    persona: "DAO Treasurer",
    title: "Governance-bounded autonomous spending",
    body: "A DAO votes on a quarterly budget for an ops agent. Limits stay encrypted on-chain — competitors verify the agent is bounded without learning the cap.",
  },
  {
    persona: "AI Ops at a SaaS company",
    title: "Subscription auto-pay with hard ceilings",
    body: "Agents renew vendors and top up API credits — never above the cap finance agreed to. Anything over the limit is silently rejected on-chain.",
  },
  {
    persona: "Trading Desk",
    title: "Encrypted budget for OTC settlement bots",
    body: "Counterparties verify settlement happened. Strategy size, P&L, and inventory stay private. Auditor-only decryption keeps compliance happy.",
  },
  {
    persona: "Family Office",
    title: "Delegated allocations without leaking holdings",
    body: "A wealth manager runs an allocation agent across whitelisted custodians. Custodians decrypt only their own inflows. Owner rotates policy weekly.",
  },
];

const steps = [
  {
    n: "01",
    title: "Encrypt policy",
    body: "Owner commits budget, per-payment cap, and total cap as FHE ciphertext. Agent and auditor are bound at the same time.",
  },
  {
    n: "02",
    title: "Agent spends",
    body: "Amount is encrypted in the browser. The contract runs ge / le / and over ciphertext, updates state on success, leaves it untouched on silent failure.",
  },
  {
    n: "03",
    title: "Selective reveal",
    body: "Owner and auditor see balance + spend. Merchant decrypts only its own revenue. Everyone else sees nothing on-chain.",
  },
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
            Give an AI agent a wallet,<br />
            not a blank check.
          </h1>
          <p className="hero__lede">
            CipherAgent Pay is the encrypted policy layer for autonomous agent treasuries.
            Budgets and limits stay encrypted on-chain. Approvals are computed on ciphertext.
            Only the right role ever decrypts.
          </p>
          <div className="hero__cta">
            <Link to="/app" className="btn btn--primary">
              Launch Studio <span aria-hidden="true">→</span>
            </Link>
            <Link to="/explorer" className="btn btn--ghost">
              Live activity
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

      <section className="why">
        <div className="why__inner">
          <p className="kicker">Why now</p>
          <h2>Agents are getting wallets faster than guardrails.</h2>
          <p className="why__lede">
            Public limits are competitive intel. Off-chain controls don't compose with smart
            contracts. "Just trust the agent" doesn't pass an audit. CipherAgent Pay puts the
            limits inside the agent's wallet, encrypted, and lets one person stop everything in
            one transaction.
          </p>
        </div>
      </section>

      <section id="how" className="how">
        <div className="section__head">
          <p className="kicker">How it works</p>
          <h2>Three encrypted moves.</h2>
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
          <p className="kicker">Built for</p>
          <h2>The four people most exposed to agents in finance.</h2>
        </div>
        <div className="cases__grid">
          {useCases.map((c) => (
            <article key={c.persona} className="case">
              <p className="case__persona">{c.persona}</p>
              <h3>{c.title}</h3>
              <p className="case__body">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dev-cta">
        <div className="dev-cta__copy">
          <p className="kicker">For builders</p>
          <h2>Five lines from any agent runtime.</h2>
          <p>
            Drop the SDK into LangGraph, AgentKit, Temporal, or anything with an ethers signer.
            Set policies, request payments, and decrypt scoped views with typed, awaitable calls.
          </p>
          <Link to="/developers" className="btn btn--primary btn--sm">
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
    </div>
  );
}
