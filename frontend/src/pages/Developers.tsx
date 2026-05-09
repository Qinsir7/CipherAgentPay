import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const sections = [
  { id: "install", label: "Install" },
  { id: "connect", label: "Connect a signer" },
  { id: "set-policy", label: "Set encrypted policy" },
  { id: "fund", label: "Fund the treasury" },
  { id: "request-payment", label: "Request a payment" },
  { id: "decrypt", label: "Decrypt scoped view" },
  { id: "events", label: "Indexed events" },
];

export default function Developers() {
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs">
      <header className="docs__hero">
        <p className="kicker">Developer guide</p>
        <h1>Wire CipherAgent Pay into any agent runtime.</h1>
        <p className="docs__lede">
          The TypeScript client wraps the Zama relayer SDK and the CipherAgentPay contract so
          that any agent — a LangGraph node, an AgentKit action, a Temporal worker, anything
          with an ethers signer — can set policies, request payments, and decrypt scoped views
          in a few lines.
        </p>
      </header>

      <div className="docs__layout">
        <aside className="docs__nav">
          <p className="docs__nav-heading">On this page</p>
          <ul>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={active === s.id ? "is-active" : ""}
                >
                  <span className="docs__nav-num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <div className="docs__content">
          <Section id="install" index="01" title="Install">
            <p>Bring the Zama relayer SDK and ethers v6 into your project, then drop the client in.</p>
            <Code>{`npm install @zama-fhe/relayer-sdk ethers`}</Code>
            <p className="docs__note">
              The client lives at <code>frontend/src/lib/cipher-agent-client.ts</code>. Copy it
              unchanged into your agent project, or import from the workspace.
            </p>
          </Section>

          <Section id="connect" index="02" title="Connect a signer">
            <p>
              The client accepts any ethers <code>Signer</code> wired to a Sepolia provider.
              Browser wallets, KMS-backed signers, and Vault-issued keys all work the same way.
            </p>
            <Code>{`import { BrowserProvider } from "ethers";
import { CipherAgentClient } from "./lib/cipher-agent-client";

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = await CipherAgentClient.connect({
  contract: process.env.CIPHER_AGENT_PAY!,
  signer,
});`}</Code>
          </Section>

          <Section id="set-policy" index="03" title="Set encrypted policy">
            <p>
              The owner commits a budget, per-payment cap, and total cap as ciphertext. If a
              policy is already active for the connected wallet, the same call rotates it
              (totals reset, merchants preserved).
            </p>
            <Code>{`await client.setPolicy({
  agent: "0xAgentWallet…",
  initialMerchant: "0xVendorWallet…",
  policy: {
    budget: 1_000n,
    perPaymentLimit: 50n,
    totalSpendLimit: 1_000n,
  },
});`}</Code>
          </Section>

          <Section id="fund" index="04" title="Fund the treasury">
            <p>Encrypted top-ups. The deposit amount is hidden from the chain.</p>
            <Code>{`await client.fund(500n);`}</Code>
          </Section>

          <Section id="request-payment" index="05" title="Agent requests a payment">
            <p>
              Connect the client with the agent's signer. The amount is encrypted in-process; the
              contract evaluates <code>balance ≥ amount</code>, <code>amount ≤ perPaymentLimit</code>,
              and <code>cumulativeSpent ≤ totalSpendLimit</code> homomorphically. Failures are
              silent on-chain to avoid leaking limit boundaries.
            </p>
            <Code>{`await client.requestPayment({
  owner: ownerAddress,
  merchant: vendorAddress,
  amount: 12n,
});`}</Code>
          </Section>

          <Section id="decrypt" index="06" title="Decrypt scoped view">
            <p>
              Each role gets exactly the slice they are entitled to. Owner and auditor see
              treasury state. A merchant sees only its own revenue. The same call returns
              nothing for unrelated wallets.
            </p>
            <Code>{`const view = await client.decryptMyView({
  owner: ownerAddress,
  merchant: vendorAddress,
});

view.balance;             // owner / auditor only
view.totalSpent;          // owner / auditor only
view.lastPaymentApproved; // boolean
view.merchantRevenue;     // merchant only`}</Code>
          </Section>

          <Section id="events" index="07" title="Indexed events for monitoring">
            <p>
              The protocol emits public, plaintext-safe events you can pipe into Datadog,
              The Graph, or a custom indexer. None of them leak amounts.
            </p>
            <ul className="docs__list">
              <li><code>PolicyCreated(owner, agent, initialMerchant)</code></li>
              <li><code>PolicyRotated(owner, agent)</code></li>
              <li><code>PolicyPaused(owner, paused)</code></li>
              <li><code>MerchantUpdated(owner, merchant, allowed)</code></li>
              <li><code>AuditorUpdated(owner, auditor)</code></li>
              <li><code>PaymentEvaluated(owner, agent, merchant, paymentId)</code></li>
              <li><code>TreasuryFunded(owner)</code></li>
            </ul>
            <div className="docs__cta">
              <Link to="/app" className="btn btn--primary btn--sm">Open Studio →</Link>
              <Link to="/explorer" className="btn btn--ghost btn--sm">See live activity</Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="docs__section">
      <header>
        <span className="docs__section-num">{index}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="code">
      <code>{children}</code>
    </pre>
  );
}
