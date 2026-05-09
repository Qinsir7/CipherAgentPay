import { Link } from "react-router-dom";

const useCases = [
  {
    persona: "DAO Treasurer",
    title: "Governance-bounded autonomous spending",
    body: "A DAO votes on a quarterly budget for an ops agent. Limits stay encrypted on-chain — competitors verify the agent is bounded without learning the cap.",
  },
  {
    persona: "AI Ops at a SaaS company",
    title: "Subscription auto-pay with hard ceilings",
    body: "Agents renew vendors and top up API credits — never above the cap finance signed off on. Anything over the limit is silently rejected on-chain.",
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
    title: "Encrypt the policy",
    body: "The owner commits a budget, a per-payment cap, and a total cap as ciphertext. The agent and an optional auditor are bound at the same time.",
  },
  {
    n: "02",
    title: "Agent spends",
    body: "Each payment amount is encrypted in the browser. The contract checks balance and limits over ciphertext, updates state on success, leaves it untouched on a silent reject.",
  },
  {
    n: "03",
    title: "Selective reveal",
    body: "The owner and auditor see balance and spend. A merchant decrypts only its own revenue. Anyone else sees nothing on-chain.",
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__aurora" aria-hidden="true">
          <div className="hero__aurora-orb hero__aurora-orb--mint" />
          <div className="hero__aurora-orb hero__aurora-orb--peach" />
          <div className="hero__aurora-orb hero__aurora-orb--violet" />
        </div>
        <div className="hero__grid" aria-hidden="true" />

        <div className="hero__inner">
          <div className="hero__copy">
            <p className="hero__eyebrow">
              <span className="dot" /> Live on Sepolia · Powered by Zama FHEVM
            </p>
            <h1 className="hero__title">
              Give an AI agent <em>a wallet</em>,
              <br />
              not a <em>blank&nbsp;check</em>.
            </h1>
            <p className="hero__lede">
              CipherAgent Pay lets you set a spending policy your agent must obey —
              encrypted end-to-end, enforced on-chain, paused in a single transaction.
            </p>
            <div className="hero__cta">
              <Link to="/app" className="btn btn--primary">
                Launch Studio <span aria-hidden="true">→</span>
              </Link>
              <Link to="/explorer" className="btn btn--ghost">
                See live activity
              </Link>
            </div>
          </div>

          <aside className="hero__viz" aria-hidden="true">
            <div className="viz__card viz__card--policy">
              <span className="viz__chip">policy · encrypted</span>
              <p className="viz__title">Quarterly cap</p>
              <p className="viz__cipher">euint64 · 0x9f4a…c2e1</p>
              <div className="viz__bar"><span style={{ width: "62%" }} /></div>
              <p className="viz__meta">budget remaining · ciphertext</p>
            </div>
            <div className="viz__card viz__card--payment">
              <span className="viz__chip viz__chip--warm">payment · evaluated</span>
              <p className="viz__title">approved on ciphertext</p>
              <p className="viz__cipher">silent reject if over cap</p>
              <p className="viz__meta">amount stays encrypted on-chain</p>
            </div>
            <div className="viz__line" />
          </aside>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[
            "Encrypted at rest, in motion, in compute",
            "Live on Sepolia",
            "Zero leak on policy breach",
            "Composable with ERC-7984",
            "EIP-712 per-role decryption",
            "Single-tx kill switch",
          ]
            .concat([
              "Encrypted at rest, in motion, in compute",
              "Live on Sepolia",
              "Zero leak on policy breach",
              "Composable with ERC-7984",
              "EIP-712 per-role decryption",
              "Single-tx kill switch",
            ])
            .map((item, i) => (
              <span key={i} className="ticker__item">
                {item}
              </span>
            ))}
        </div>
      </div>

      <section className="why">
        <div className="why__inner">
          <p className="kicker">Why now</p>
          <h2>Agents are getting wallets faster than guardrails.</h2>
          <p className="why__lede">
            Plaintext spending limits leak strategy to competitors and counterparties.
            Off-chain controls disappear the moment an agent calls a smart contract.
            "Just trust the agent" doesn't pass an audit. CipherAgent Pay makes the limits
            part of the wallet itself — encrypted, enforced on-chain, revocable in one tap.
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
          <h2>The teams most exposed to autonomous spend.</h2>
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
            Drop the SDK into LangGraph, AgentKit, Temporal, or anything with an ethers
            signer. Set a policy, request a payment, decrypt a scoped view — all typed,
            all awaitable, all Sepolia-ready.
          </p>
          <Link to="/developers" className="btn btn--primary btn--sm">
            Open developer guide →
          </Link>
        </div>
        <pre className="dev-cta__code">
          <code>{`import { CipherAgentClient } from "cipher-agent-pay";

const client = await CipherAgentClient.connect({
  contract,
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
