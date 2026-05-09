import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const sections = [
  { id: "install", label: "Install" },
  { id: "architecture", label: "Architecture" },
  { id: "connect", label: "Connect a signer" },
  { id: "set-policy", label: "Set encrypted policy" },
  { id: "fund", label: "Fund the treasury" },
  { id: "request-payment", label: "Request a payment" },
  { id: "headless", label: "Headless agent example" },
  { id: "decrypt", label: "Decrypt scoped view" },
  { id: "events", label: "Indexed events" },
  { id: "threat-model", label: "Threat model" },
  { id: "what-you-can-build", label: "What you can build" },
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
        <p className="kicker">Developer guide · v0.1</p>
        <h1>Wire CipherAgent Pay into any agent runtime.</h1>
        <p className="docs__lede">
          A 330-line Solidity contract, a 230-line TypeScript client, and a single ACL
          primitive that holds it together. Drop the client into a LangGraph node, an
          AgentKit action, a Temporal worker, or a Vault-backed Node service — anywhere
          you can hold an ethers signer.
        </p>
        <div className="docs__hero-meta">
          <span>Solidity 0.8.24 · viaIR · Cancun EVM</span>
          <span>FHEVM @ Sepolia · Zama relayer SDK 0.4</span>
          <span>ethers v6 · React 19 (optional)</span>
        </div>
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
            <p>
              Bring the Zama relayer SDK and ethers v6 into your project, then drop the
              client in. The client lives at <code>frontend/src/lib/cipher-agent-client.ts</code> —
              copy it unchanged or import from the workspace.
            </p>
            <Code>{`npm install @zama-fhe/relayer-sdk ethers`}</Code>
            <p className="docs__note">
              Browser callers need <code>cross-origin-embedder-policy</code> and
              <code> cross-origin-opener-policy</code> headers (already wired in
              <code> vercel.json</code>). Node callers need no headers — just a Sepolia
              RPC and a private key.
            </p>
          </Section>

          <Section id="architecture" index="02" title="Architecture">
            <p>
              Three roles, one contract, one ACL grant matrix. The owner is sovereign:
              there is no admin key, no upgrade proxy, no protocol fee. Every encrypted
              handle the contract returns is gated by an explicit{" "}
              <code>FHE.allow(handle, addr)</code>; addresses outside that grant cannot
              decrypt, regardless of what they query.
            </p>
            <Code>{`              owner.eoa
                 │
                 │  encrypts policy in browser via Zama relayer SDK
                 ▼
    ┌──────────────────────────────────────┐
    │       CipherAgentPay  (FHEVM)         │
    │  · euint64  budget / caps / spent     │
    │  · ebool    lastPaymentApproved       │
    │  · euint64  per-merchant revenue      │
    │  · ACL grant matrix, per handle       │
    └──────────────────────────────────────┘
        ▲                 ▲                ▲
        │                 │                │
   agent.eoa         auditor.eoa     merchant.eoa
   (spends under     (decrypts        (decrypts only
    encrypted cap)    treasury view)   own revenue)`}</Code>
            <p>
              Approval is computed homomorphically:
              <code> balance ≥ amount</code> ∧ <code>amount ≤ perPaymentCap</code> ∧{" "}
              <code>spent + amount ≤ totalCap</code>. Every state slot is wrapped in{" "}
              <code>FHE.select(approved, …, untouched)</code> so that an over-limit
              attempt leaves an on-chain footprint identical to a successful one — the
              balance leak a plaintext <code>require()</code> would create is
              structurally eliminated.
            </p>
          </Section>

          <Section id="connect" index="03" title="Connect a signer">
            <p>
              The client accepts any ethers <code>Signer</code> wired to a Sepolia
              provider. Browser wallets, KMS-backed signers, AWS Vault, Fireblocks
              co-signers, or a hot key inside a Temporal worker — all work the same way.
            </p>
            <Code>{`import { BrowserProvider } from "ethers";
import { CipherAgentClient } from "./lib/cipher-agent-client";

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = await CipherAgentClient.connect({
  contract: process.env.CIPHER_AGENT_PAY!,
  signer,
});`}</Code>
            <p className="docs__note">
              Multi-wallet browsers? The Studio implements EIP-6963 wallet discovery;
              see <code>frontend/src/lib/wallets.ts</code> for a 50-line drop-in.
            </p>
          </Section>

          <Section id="set-policy" index="04" title="Set encrypted policy">
            <p>
              The owner commits a budget, per-payment cap, and total cap as ciphertext.
              If a policy is already active for the connected wallet, the same call
              rotates it (totals reset, merchants preserved). One transaction, three
              encrypted handles, zero plaintext leaves the browser.
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

          <Section id="fund" index="05" title="Fund the treasury">
            <p>
              Encrypted top-ups. The deposit amount and the new running balance are
              indistinguishable to outside observers — the only public signal is the
              <code> TreasuryFunded</code> event on the owner address.
            </p>
            <Code>{`await client.fund(500n);`}</Code>
          </Section>

          <Section id="request-payment" index="06" title="Agent requests a payment">
            <p>
              Connect the client with the agent's signer. The amount is encrypted
              in-process; the contract evaluates the three predicates homomorphically
              and updates state via <code>FHE.select</code>. Failures are silent
              on-chain to avoid leaking limit boundaries.
            </p>
            <Code>{`await client.requestPayment({
  owner: ownerAddress,
  merchant: vendorAddress,
  amount: 12n,
});`}</Code>
          </Section>

          <Section id="headless" index="07" title="Headless agent example">
            <p>
              The Studio is one client. The same SDK powers a Node-side autonomous agent
              with a Vault-backed signer. The full example is in{" "}
              <code>examples/agentkit-spend-agent.ts</code> (drop-in shape compatible
              with Coinbase AgentKit, LangGraph nodes, or any runtime that hands you an
              ethers Signer).
            </p>
            <Code>{`import { JsonRpcProvider, Wallet } from "ethers";
import { CipherAgentClient } from "../frontend/src/lib/cipher-agent-client";

const signer = new Wallet(process.env.PRIVATE_KEY!,
  new JsonRpcProvider(process.env.SEPOLIA_RPC_URL!));

const client = await CipherAgentClient.connect({
  contract: process.env.CIPHER_AGENT_PAY!,
  signer,
});

const policy = await client.getPolicyState(process.env.POLICY_OWNER!);
if (!policy.initialized || policy.paused) throw new Error("policy not live");

for (const intent of intents) {
  const txHash = await client.requestPayment({
    owner: process.env.POLICY_OWNER!,
    merchant: intent.vendor,
    amount: intent.amount,
  });
  console.log("submitted encrypted payment", txHash);
}`}</Code>
            <p className="docs__note">
              Run with{" "}
              <code>
                PRIVATE_KEY=… CIPHER_AGENT_PAY=… POLICY_OWNER=… npx tsx examples/agentkit-spend-agent.ts
              </code>
              . The spending limits never enter the agent's process — they live on
              ciphertext inside the contract. A compromised agent key cannot exceed them.
            </p>
          </Section>

          <Section id="decrypt" index="08" title="Decrypt scoped view">
            <p>
              Each role gets exactly the slice they are entitled to. Owner and auditor
              see treasury state; a merchant sees only its own revenue; an unrelated
              wallet receives a clean refusal — never a partial leak. The ACL grant
              matrix in <code>_allowAccountDecryptions</code> is the single source of
              truth.
            </p>
            <Code>{`const view = await client.decryptMyView({
  owner: ownerAddress,
  merchant: vendorAddress,
});

view.balance;             // owner / auditor only
view.totalSpent;          // owner / auditor only
view.lastPaymentApproved; // owner / auditor only
view.merchantRevenue;     // merchant only`}</Code>
          </Section>

          <Section id="events" index="09" title="Indexed events">
            <p>
              The protocol emits public, plaintext-safe events you can pipe into
              Datadog, The Graph, a Dune dashboard, or a SOC 2 audit log. None of them
              leak amounts. Every payment carries a monotonic <code>paymentId</code> so
              a subgraph can stream them without ambiguity.
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
              <Link to="/explorer" className="btn btn--ghost btn--sm">See live activity →</Link>
            </div>
          </Section>

          <Section id="threat-model" index="10" title="Threat model">
            <p>
              CipherAgent Pay is privacy by selective disclosure, not anonymity.
              Participant addresses, transaction existence, and the merchant allowlist
              are public — that's deliberate, and what regulators expect from an
              auditable institutional product. The four attack surfaces below are the
              ones the design specifically defends against.
            </p>
            <table className="docs__threats">
              <thead>
                <tr>
                  <th>Vector</th>
                  <th>Mitigation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Compromised agent key</td>
                  <td>
                    Encrypted per-call and total caps are enforced on ciphertext —
                    cannot be exceeded from a captured private key. Owner triggers{" "}
                    <code>pausePolicy(true)</code> + <code>rotatePolicy(…)</code> in two
                    transactions.
                  </td>
                </tr>
                <tr>
                  <td>Vendor sees other vendors' revenue</td>
                  <td>
                    Per-merchant revenue handle is granted only to the merchant address
                    via <code>FHE.allow</code>. Peers querying the same getter receive
                    an opaque handle they cannot decrypt.
                  </td>
                </tr>
                <tr>
                  <td>Cross-chain ciphertext replay</td>
                  <td>
                    The Zama instance config (<code>SepoliaConfig</code>) binds proofs
                    to a specific chain and contract address; mismatched proofs fail
                    verification before any state write.
                  </td>
                </tr>
                <tr>
                  <td>Owner signs the wrong policy</td>
                  <td>
                    The wallet displays a typed EIP-712 envelope before signing the
                    decryption request; on-chain ciphertext writes are addressable in
                    the calldata for review on Etherscan.
                  </td>
                </tr>
                <tr>
                  <td>Stale auditor after a personnel change</td>
                  <td>
                    <code>setAuditor(0x0)</code> revokes future writes. To drop access
                    to historical handles, follow up with{" "}
                    <code>rotatePolicy(…)</code>; the old ciphertexts become orphaned.
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section id="what-you-can-build" index="11" title="What you can build">
            <p>
              A non-exhaustive list. The contract is intentionally token-agnostic: the
              same primitive composes above ETH today, ERC-7984 cUSDC tomorrow.
            </p>
            <ul className="docs__list docs__list--ideas">
              <li>
                <strong>Autonomous procurement agent</strong> · A LangGraph node spends
                under a DAO-set encrypted budget for SaaS, RPC, and inference invoices.
              </li>
              <li>
                <strong>Per-tenant SaaS billing</strong> · Each tenant of a multi-tenant
                product gets its own encrypted policy; the SaaS provider acts as
                auditor for incident response, with no plaintext billing on chain.
              </li>
              <li>
                <strong>Agent-to-agent micropayments</strong> · Two autonomous agents
                negotiate a price, the buyer's policy enforces a per-call cap, and
                neither side learns the other's runway.
              </li>
              <li>
                <strong>Reimbursement flows for distributed teams</strong> · Employees
                spend under a department policy; finance is the auditor; vendors see
                only their own invoiced totals — VAT-friendly without a shadow ledger.
              </li>
              <li>
                <strong>Confidential grant disbursement</strong> · A grant program
                publishes per-recipient encrypted budgets so total runway and cohort
                composition stay private during the active grant window.
              </li>
              <li>
                <strong>Compliance-grade enterprise AI fleets</strong> · Each internal
                AI assistant has an encrypted spend cap; internal audit gets first-class
                decrypt access; the controller-processor model regulators expect maps
                straight onto the ACL primitive.
              </li>
            </ul>
            <div className="docs__cta">
              <Link to="/app" className="btn btn--primary btn--sm">Open Studio →</Link>
              <a
                href="https://github.com/Qinsir7/CipherAgentPay"
                target="_blank"
                rel="noreferrer"
                className="btn btn--ghost btn--sm"
              >
                Source on GitHub
              </a>
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
