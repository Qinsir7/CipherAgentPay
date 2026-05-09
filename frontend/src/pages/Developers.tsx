import { Link } from "react-router-dom";

const contractAddress = (import.meta.env.VITE_CIPHER_AGENT_PAY_ADDRESS as string) ?? "0x…";

export default function Developers() {
  return (
    <div className="docs">
      <header className="docs__hero">
        <p className="kicker">Developer guide</p>
        <h1>Wire CipherAgent Pay into any agent runtime.</h1>
        <p className="docs__lede">
          The TypeScript client wraps the Zama relayer SDK and the CipherAgentPay contract so that
          your AI agent — LangGraph node, AgentKit action, Temporal worker, anything with an ethers
          signer — can set policy, request payments, and decrypt scoped views in a few lines.
        </p>
      </header>

      <nav className="docs__toc">
        {[
          ["install", "Install"],
          ["connect", "Connect a signer"],
          ["set-policy", "Set encrypted policy"],
          ["fund", "Fund the treasury"],
          ["request-payment", "Agent requests a payment"],
          ["decrypt", "Decrypt scoped view"],
          ["events", "Indexed events"],
          ["sepolia", "Live deployment"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section id="install" className="docs__section">
        <h2>Install</h2>
        <p>Bring the Zama relayer SDK and ethers v6 into your project, then drop the client in.</p>
        <Code>{`npm install @zama-fhe/relayer-sdk ethers`}</Code>
        <p className="docs__note">
          The client lives at <code>frontend/src/lib/cipher-agent-client.ts</code>. Copy it
          unchanged into your agent project, or import from the workspace.
        </p>
      </section>

      <section id="connect" className="docs__section">
        <h2>Connect a signer</h2>
        <p>
          The client accepts any ethers <code>Signer</code> wired to a Sepolia provider. Browser
          wallets, KMS-backed signers, and Vault-issued keys all work the same way.
        </p>
        <Code>{`import { BrowserProvider } from "ethers";
import { CipherAgentClient } from "./lib/cipher-agent-client";

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = await CipherAgentClient.connect({
  contract: "${contractAddress}",
  signer,
});`}</Code>
      </section>

      <section id="set-policy" className="docs__section">
        <h2>Set encrypted policy</h2>
        <p>
          The owner commits a budget, per-payment cap, and total cap as ciphertext. If a policy is
          already active for the connected wallet, the same call rotates it (totals reset, merchants
          preserved).
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
      </section>

      <section id="fund" className="docs__section">
        <h2>Fund the treasury</h2>
        <p>Encrypted top-ups. The deposit amount is hidden from the chain.</p>
        <Code>{`await client.fund(500n);`}</Code>
      </section>

      <section id="request-payment" className="docs__section">
        <h2>Agent requests a payment</h2>
        <p>
          Connect the client with the agent's signer. The amount is encrypted in-process; the
          contract evaluates <code>balance ≥ amount</code>, <code>amount ≤ perPaymentLimit</code>,
          and <code>cumulativeSpent ≤ totalSpendLimit</code> homomorphically. Failures are silent
          on-chain to avoid leaking limit boundaries.
        </p>
        <Code>{`await client.requestPayment({
  owner: ownerAddress,
  merchant: vendorAddress,
  amount: 12n,
});`}</Code>
      </section>

      <section id="decrypt" className="docs__section">
        <h2>Decrypt scoped view</h2>
        <p>
          Each role gets exactly the slice they are entitled to. Owner and auditor see treasury
          state. Merchant sees only its own revenue. The same call returns nothing for unrelated
          wallets.
        </p>
        <Code>{`const view = await client.decryptMyView({
  owner: ownerAddress,
  merchant: vendorAddress,
});

console.log(view.balance);            // owner / auditor only
console.log(view.totalSpent);         // owner / auditor only
console.log(view.lastPaymentApproved); // boolean
console.log(view.merchantRevenue);    // merchant only`}</Code>
      </section>

      <section id="events" className="docs__section">
        <h2>Indexed events for monitoring</h2>
        <p>
          The protocol emits public, plaintext-safe events you can pipe into Datadog, The Graph, or
          a custom indexer. None of them leak amounts.
        </p>
        <ul className="docs__list">
          <li><code>PolicyCreated(owner, agent, initialMerchant)</code></li>
          <li><code>PolicyRotated(owner, agent)</code></li>
          <li><code>PolicyPaused(owner, paused)</code></li>
          <li><code>MerchantUpdated(owner, merchant, allowed)</code></li>
          <li><code>AuditorUpdated(owner, auditor)</code></li>
          <li><code>PaymentEvaluated(owner, agent, merchant, nonce)</code></li>
          <li><code>TreasuryFunded(owner)</code></li>
        </ul>
      </section>

      <section id="sepolia" className="docs__section">
        <h2>Live on Sepolia</h2>
        <p>
          The reference contract is live and verified. Use it directly to integrate, or deploy your
          own with the included Hardhat scripts.
        </p>
        <p className="docs__contract">
          <span>Contract</span>
          <a
            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            <code>{contractAddress}</code>
          </a>
        </p>
        <div className="docs__cta">
          <Link to="/app" className="btn btn--primary">Open Studio →</Link>
          <a
            href="https://docs.zama.ai/protocol"
            target="_blank"
            rel="noreferrer"
            className="btn btn--ghost"
          >
            Zama Protocol docs
          </a>
        </div>
      </section>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="code">
      <code>{children}</code>
    </pre>
  );
}
