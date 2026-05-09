import { createInstance, initSDK, SepoliaConfig, type FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { BrowserProvider, Contract, hexlify, isAddress } from "ethers";
import { useMemo, useState } from "react";

import { cipherAgentPayAbi } from "../cipherAgentPayAbi";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type AgentState = {
  agent: string;
  auditor: string;
  initialized: boolean;
  paused: boolean;
};

const contractAddress = (import.meta.env.VITE_CIPHER_AGENT_PAY_ADDRESS as string) ?? "";
const sepoliaChainId = 11155111n;

export default function Studio() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("Connect a Sepolia wallet to begin.");
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [ownerAddress, setOwnerAddress] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [auditorAddress, setAuditorAddress] = useState("");
  const [merchantAddress, setMerchantAddress] = useState("");
  const [merchantAllowed, setMerchantAllowed] = useState<boolean | null>(null);
  const [budget, setBudget] = useState("500");
  const [perPaymentLimit, setPerPaymentLimit] = useState("50");
  const [totalSpendLimit, setTotalSpendLimit] = useState("500");
  const [paymentAmount, setPaymentAmount] = useState("12");
  const [decryptResults, setDecryptResults] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [fhevm, setFhevm] = useState<FhevmInstance | null>(null);

  const isConfigured = useMemo(() => isAddress(contractAddress), []);

  async function getSignerContract() {
    if (!window.ethereum) {
      throw new Error("No injected wallet found.");
    }
    if (!isConfigured) {
      throw new Error("Set VITE_CIPHER_AGENT_PAY_ADDRESS after deploying the contract.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== sepoliaChainId) {
      await switchToSepolia();
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    return {
      signer,
      signerAddress,
      contract: new Contract(contractAddress, cipherAgentPayAbi, signer),
    };
  }

  async function getFhevm() {
    if (fhevm) {
      return fhevm;
    }
    if (!window.ethereum) {
      throw new Error("No injected wallet found.");
    }

    setStatus("Initializing Zama relayer SDK...");
    await initSDK();
    const instance = await createInstance({
      ...SepoliaConfig,
      network: window.ethereum,
    });
    setFhevm(instance);
    return instance;
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error("Install MetaMask or another injected wallet.");
      }
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== sepoliaChainId) {
        await switchToSepolia();
      }
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setOwnerAddress(address);
      setAgentAddress(address);
      setMerchantAddress((current) => current || address);
      setStatus("Wallet connected on Sepolia. Encrypt a policy to begin.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet connection failed.");
    }
  }

  async function runAction(action: () => Promise<void>) {
    if (isBusy) return;
    setIsBusy(true);
    setDecryptResults({});
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed. Check the console for details.");
      console.error(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function createEncryptedAgent() {
    await runAction(async () => {
      const owner = ownerAddress || account;
      assertAddress(owner, "owner");
      assertAddress(agentAddress, "agent");
      assertAddress(merchantAddress, "merchant");

      const { contract, signerAddress } = await getSignerContract();
      if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error("Connect as the owner to create or rotate the agent policy.");
      }

      const [, , alreadyInitialized] = await contract.getAgent(signerAddress);

      const instance = await getFhevm();
      setStatus("Encrypting budget and spend limits with Zama relayer...");
      const input = instance.createEncryptedInput(contractAddress, signerAddress);
      input.add64(toAmount(budget));
      input.add64(toAmount(perPaymentLimit));
      input.add64(toAmount(totalSpendLimit));
      const encrypted = await input.encrypt();

      let tx;
      if (alreadyInitialized) {
        setStatus("Rotating existing policy with fresh encrypted limits...");
        tx = await contract.rotatePolicy(
          agentAddress,
          hexlify(encrypted.handles[0]),
          hexlify(encrypted.handles[1]),
          hexlify(encrypted.handles[2]),
          hexlify(encrypted.inputProof),
        );
      } else {
        setStatus("Submitting encrypted policy to Sepolia...");
        tx = await contract.createAgent(
          agentAddress,
          merchantAddress,
          hexlify(encrypted.handles[0]),
          hexlify(encrypted.handles[1]),
          hexlify(encrypted.handles[2]),
          hexlify(encrypted.inputProof),
        );
      }
      await tx.wait();

      if (!alreadyInitialized) {
        setMerchantAllowed(true);
      } else if (!(await contract.allowedMerchant(signerAddress, merchantAddress))) {
        setStatus("Policy rotated. Approving merchant on the existing allowlist...");
        const merchantTx = await contract.setMerchant(merchantAddress, true);
        await merchantTx.wait();
        setMerchantAllowed(true);
      }

      if (auditorAddress && isAddress(auditorAddress)) {
        setStatus("Policy committed. Granting auditor decrypt rights...");
        const auditorTx = await contract.setAuditor(auditorAddress);
        await auditorTx.wait();
      }

      setStatus(alreadyInitialized
        ? "Policy rotated. Spend totals reset on Sepolia."
        : "Encrypted policy is live on Sepolia.");
      await loadAgent();
    });
  }

  async function togglePause() {
    await runAction(async () => {
      const owner = ownerAddress || account;
      assertAddress(owner, "owner");
      const { contract, signerAddress } = await getSignerContract();
      if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error("Only the policy owner can pause or resume.");
      }
      const [, , initialized, paused] = await contract.getAgent(signerAddress);
      if (!initialized) {
        throw new Error("No encrypted policy found. Encrypt one first.");
      }
      const next = !paused;
      setStatus(next ? "Pausing policy on Sepolia..." : "Resuming policy on Sepolia...");
      const tx = await contract.pausePolicy(next);
      await tx.wait();
      setStatus(next ? "Policy paused. Agent payments will revert until resumed." : "Policy resumed. Agent payments are live again.");
      await loadAgent();
    });
  }

  async function loadAgent() {
    try {
      const owner = ownerAddress || account;
      if (!isAddress(owner)) {
        throw new Error("Enter a valid owner address.");
      }

      const { contract } = await getSignerContract();
      const [agent, auditor, initialized, paused] = await contract.getAgent(owner);
      setAgentState({ agent, auditor, initialized, paused });

      if (isAddress(merchantAddress)) {
        const allowed = await contract.allowedMerchant(owner, merchantAddress);
        setMerchantAllowed(Boolean(allowed));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load agent.");
    }
  }

  async function requestPayment() {
    await runAction(async () => {
      const owner = ownerAddress || account;
      assertAddress(owner, "owner");
      assertAddress(merchantAddress, "merchant");

      const { contract, signerAddress } = await getSignerContract();
      const instance = await getFhevm();
      setStatus("Encrypting payment amount in the browser...");
      const input = instance.createEncryptedInput(contractAddress, signerAddress);
      input.add64(toAmount(paymentAmount));
      const encrypted = await input.encrypt();

      setStatus("Submitting encrypted payment. The connected wallet must be the agent.");
      const tx = await contract.requestPayment(
        owner,
        merchantAddress,
        hexlify(encrypted.handles[0]),
        hexlify(encrypted.inputProof),
      );
      await tx.wait();
      setStatus("Payment evaluated on ciphertext. Decrypt your authorized view.");
    });
  }

  async function decryptMyView() {
    await runAction(async () => {
      const owner = ownerAddress || account;
      assertAddress(owner, "owner");
      const { contract, signer, signerAddress } = await getSignerContract();
      const instance = await getFhevm();
      const [, auditor, initialized] = await contract.getAgent(owner);
      if (!initialized) {
        throw new Error("No encrypted policy found for this owner address.");
      }

      const signerLower = signerAddress.toLowerCase();
      const ownerLower = owner.toLowerCase();
      const auditorLower = auditor === zeroAddress ? "" : auditor.toLowerCase();
      const merchantLower = isAddress(merchantAddress) ? merchantAddress.toLowerCase() : "";

      const isOwner = signerLower === ownerLower;
      const isAuditor = auditorLower !== "" && signerLower === auditorLower;
      const isMerchant = merchantLower !== "" && signerLower === merchantLower;

      const handlesByName: Record<string, string> = {};
      if (isOwner || isAuditor) {
        handlesByName.balance = await contract.encryptedBalance(owner);
        handlesByName.totalSpent = await contract.encryptedTotalSpent(owner);
        handlesByName.lastPaymentAmount = await contract.encryptedLastPaymentAmount(owner);
        handlesByName.lastPaymentApproved = await contract.encryptedLastPaymentApproved(owner);
      }
      if (isMerchant) {
        handlesByName.merchantRevenue = await contract.encryptedMerchantRevenue(merchantAddress);
      }

      const handles = Object.values(handlesByName).filter((handle) => handle !== zeroHandle);
      if (handles.length === 0) {
        throw new Error("Connected wallet is not the owner, auditor, or selected merchant for this policy.");
      }

      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 10;
      const contractAddresses = [contractAddress];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: [...eip712.types.UserDecryptRequestVerification] },
        eip712.message,
      );

      const role = describeRole({ isOwner, isAuditor, isMerchant });
      setStatus(`Requesting ${role} user decryption from Zama relayer...`);
      const decrypted = await instance.userDecrypt(
        handles.map((handle) => ({ handle, contractAddress })),
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        signerAddress,
        startTimestamp,
        durationDays,
      );

      const namedResults = Object.fromEntries(
        Object.entries(handlesByName).map(([name, handle]) => [
          name,
          friendlyValue(name, decrypted[handle as `0x${string}`]),
        ]),
      );
      setDecryptResults(namedResults);
      setStatus(`${role} view decrypted for ${shortAddress(signerAddress)}.`);
    });
  }

  return (
    <div className="studio">
      <aside className="studio__rail">
        <div className="rail__brand">
          <span className="rail__kicker">Studio</span>
          <h2>Encrypted policy console</h2>
          <p>Run the full owner / agent / disclosure loop on Sepolia.</p>
        </div>
        <ol className="rail__steps">
          <li><a href="#stage-policy">01 · Encrypt policy</a></li>
          <li><a href="#stage-fund">02 · Treasury &amp; controls</a></li>
          <li><a href="#stage-pay">03 · Agent payment</a></li>
          <li><a href="#stage-reveal">04 · Selective reveal</a></li>
        </ol>
        <div className="rail__contract">
          <span className="rail__kicker">Contract</span>
          {isConfigured ? (
            <a
              href={`https://sepolia.etherscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="rail__addr"
            >
              {shortAddress(contractAddress)} ↗
            </a>
          ) : (
            <span className="rail__addr rail__addr--missing">Not configured</span>
          )}
        </div>
      </aside>

      <section className="studio__main">
        <div className="studio__top">
          <div>
            <p className="kicker">Studio · Sepolia</p>
            <h1>Run an encrypted policy in three signatures.</h1>
          </div>
          <button onClick={connectWallet} disabled={isBusy} className="btn btn--primary btn--sm">
            {account ? shortAddress(account) : "Connect Sepolia wallet"}
          </button>
        </div>

        <div className="dashboard">
          <Stat label="Wallet" value={account ? shortAddress(account) : "—"} />
          <Stat
            label="Policy"
            value={agentState?.initialized ? (agentState.paused ? "Paused" : "Live") : "Not set"}
            tone={agentState?.initialized ? (agentState.paused ? "warn" : "good") : "muted"}
          />
          <Stat label="Agent" value={agentState?.initialized ? shortAddress(agentState.agent) : "—"} />
          <Stat label="Auditor" value={agentState?.initialized ? shortAddress(agentState.auditor) : "—"} />
          <Stat
            label="Merchant"
            value={merchantAllowed === null ? "—" : merchantAllowed ? "Allowed" : "Blocked"}
            tone={merchantAllowed === null ? "muted" : merchantAllowed ? "good" : "warn"}
          />
        </div>

        <p className="status-line">
          <span className={isBusy ? "dot busy" : "dot"} />
          {status}
        </p>

        <article id="stage-policy" className="panel">
          <header>
            <span className="panel__num">01</span>
            <div>
              <h2>Encrypt the spending policy</h2>
              <p>Budget, per-payment cap, and total cap leave the browser as ciphertext. Agent and auditor are bound at creation.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field label="Agent address" value={agentAddress} onChange={setAgentAddress} placeholder="0x…" />
            <Field label="Initial merchant" value={merchantAddress} onChange={setMerchantAddress} placeholder="0x…" />
            <Field label="Auditor (optional)" value={auditorAddress} onChange={setAuditorAddress} placeholder="0x…" />
            <Field label="Initial budget" value={budget} onChange={setBudget} />
            <Field label="Per-payment limit" value={perPaymentLimit} onChange={setPerPaymentLimit} />
            <Field label="Total spend limit" value={totalSpendLimit} onChange={setTotalSpendLimit} />
          </div>
          <div className="panel__actions">
            <button onClick={createEncryptedAgent} disabled={isBusy} className="btn btn--primary btn--sm">
              {agentState?.initialized ? "Rotate encrypted policy" : "Encrypt & set policy"}
            </button>
            {agentState?.initialized && (
              <button className="btn btn--ghost btn--sm" onClick={togglePause} disabled={isBusy}>
                {agentState.paused ? "Resume agent" : "Pause agent"}
              </button>
            )}
          </div>
        </article>

        <article id="stage-fund" className="panel">
          <header>
            <span className="panel__num">02</span>
            <div>
              <h2>Inspect treasury &amp; controls</h2>
              <p>Reload state, verify auditor binding, confirm merchant is on the allowlist.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field label="Owner to inspect" value={ownerAddress} onChange={setOwnerAddress} placeholder="0x…" />
          </div>
          <div className="panel__actions">
            <button onClick={loadAgent} disabled={isBusy} className="btn btn--ghost btn--sm">
              Refresh policy state
            </button>
          </div>
        </article>

        <article id="stage-pay" className="panel">
          <header>
            <span className="panel__num">03</span>
            <div>
              <h2>Agent submits an encrypted payment</h2>
              <p>The amount is encrypted in the browser. The contract checks balance and limits on ciphertext, updates state on success.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field label="Encrypted amount" value={paymentAmount} onChange={setPaymentAmount} />
          </div>
          <div className="panel__actions">
            <button onClick={requestPayment} disabled={isBusy} className="btn btn--primary btn--sm">
              Submit encrypted payment
            </button>
          </div>
        </article>

        <article id="stage-reveal" className="panel">
          <header>
            <span className="panel__num">04</span>
            <div>
              <h2>Decrypt only what your role allows</h2>
              <p>The connected wallet signs an EIP-712 request. Owner/auditor see treasury state. Merchant sees only its own revenue.</p>
            </div>
          </header>
          <div className="panel__actions">
            <button onClick={decryptMyView} disabled={isBusy} className="btn btn--primary btn--sm">
              Decrypt my view
            </button>
          </div>
          {Object.keys(decryptResults).length > 0 && (
            <dl className="facts">
              {Object.entries(decryptResults).map(([name, value]) => (
                <div key={name}>
                  <dt>{friendlyLabel(name)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "good" | "warn" | "muted" }) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

const zeroHandle = "0x0000000000000000000000000000000000000000000000000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000";

async function switchToSepolia() {
  const ethereum = window.ethereum as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  if (!ethereum?.request) {
    throw new Error("Wallet does not support network switching.");
  }
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
  } catch {
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ],
    });
  }
}

function assertAddress(address: string, label: string) {
  if (!isAddress(address)) {
    throw new Error(`Enter a valid ${label} address.`);
  }
}

function toAmount(value: string) {
  const parsed = BigInt(value);
  if (parsed < 0n) {
    throw new Error("Amount must be non-negative.");
  }
  return parsed;
}

function friendlyLabel(name: string) {
  const labels: Record<string, string> = {
    balance: "balance",
    totalSpent: "total spent",
    lastPaymentAmount: "last payment",
    lastPaymentApproved: "last payment status",
    merchantRevenue: "merchant revenue",
  };
  return labels[name] ?? name;
}

function friendlyValue(name: string, value: unknown) {
  if (name === "lastPaymentApproved") {
    return value === true ? "approved" : "blocked";
  }
  if (typeof value === "bigint" || typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value ?? "not authorized");
}

function describeRole(roles: { isOwner: boolean; isAuditor: boolean; isMerchant: boolean }) {
  const tags = [
    roles.isOwner ? "owner" : null,
    roles.isAuditor ? "auditor" : null,
    roles.isMerchant ? "merchant" : null,
  ].filter(Boolean);
  return tags.length === 0 ? "viewer" : tags.join(" + ");
}

function shortAddress(address: string) {
  if (!isAddress(address)) {
    return "not set";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
