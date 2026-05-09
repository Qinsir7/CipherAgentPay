import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { useEffect, useMemo, useState } from "react";

import { cipherAgentPayAbi } from "../cipherAgentPayAbi";

type EventRow = {
  kind: "PolicyCreated" | "PolicyRotated" | "PolicyPaused" | "PaymentEvaluated" | "MerchantUpdated" | "TreasuryFunded";
  blockNumber: number;
  txHash: string;
  owner?: string;
  agent?: string;
  merchant?: string;
  paused?: boolean;
  allowed?: boolean;
  paymentId?: bigint;
};

const contractAddress = (import.meta.env.VITE_CIPHER_AGENT_PAY_ADDRESS as string) ?? "";
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const LOOKBACK_BLOCKS = 50_000;

export default function Explorer() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isAddress(contractAddress);

  useEffect(() => {
    let cancelled = false;
    if (!isConfigured) {
      setError("Set VITE_CIPHER_AGENT_PAY_ADDRESS to load the live trail.");
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const provider = new JsonRpcProvider(SEPOLIA_RPC);
        const contract = new Contract(contractAddress, cipherAgentPayAbi, provider);
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - LOOKBACK_BLOCKS);

        const [created, rotated, paused, payments, merchant, funded] = await Promise.all([
          contract.queryFilter(contract.filters.PolicyCreated(), fromBlock, latest),
          contract.queryFilter(contract.filters.PolicyRotated(), fromBlock, latest),
          contract.queryFilter(contract.filters.PolicyPaused(), fromBlock, latest),
          contract.queryFilter(contract.filters.PaymentEvaluated(), fromBlock, latest),
          contract.queryFilter(contract.filters.MerchantUpdated(), fromBlock, latest),
          contract.queryFilter(contract.filters.TreasuryFunded(), fromBlock, latest),
        ]);

        const rows: EventRow[] = [
          ...created.map((e: any) => ({
            kind: "PolicyCreated" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
            agent: e.args?.agent,
            merchant: e.args?.initialMerchant,
          })),
          ...rotated.map((e: any) => ({
            kind: "PolicyRotated" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
            agent: e.args?.agent,
          })),
          ...paused.map((e: any) => ({
            kind: "PolicyPaused" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
            paused: e.args?.paused,
          })),
          ...payments.map((e: any) => ({
            kind: "PaymentEvaluated" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
            agent: e.args?.agent,
            merchant: e.args?.merchant,
            paymentId: e.args?.paymentId,
          })),
          ...merchant.map((e: any) => ({
            kind: "MerchantUpdated" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
            merchant: e.args?.merchant,
            allowed: e.args?.allowed,
          })),
          ...funded.map((e: any) => ({
            kind: "TreasuryFunded" as const,
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            owner: e.args?.owner,
          })),
        ].sort((a, b) => b.blockNumber - a.blockNumber);

        if (!cancelled) {
          setEvents(rows);
          setLatestBlock(latest);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity from Sepolia.");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConfigured]);

  const stats = useMemo(() => {
    const policies = new Set(events.filter((e) => e.kind === "PolicyCreated").map((e) => e.owner ?? ""));
    const payments = events.filter((e) => e.kind === "PaymentEvaluated").length;
    const rotations = events.filter((e) => e.kind === "PolicyRotated").length;
    const pauseEvents = events.filter((e) => e.kind === "PolicyPaused" && e.paused === true).length;
    return {
      uniquePolicies: policies.size,
      payments,
      rotations,
      pauses: pauseEvents,
    };
  }, [events]);

  return (
    <div className="explorer">
      <header className="explorer__hero">
        <p className="kicker">Live activity · Sepolia</p>
        <h1>Public trail of every encrypted policy and payment.</h1>
        <p className="explorer__lede">
          The contract emits indexed events on every state change. Amounts and balances stay
          encrypted — these events prove what happened without ever revealing how much.
        </p>
        {isConfigured && (
          <a
            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="explorer__contract"
          >
            <span>Contract</span>
            <code>{contractAddress}</code>
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </header>

      <div className="kpi">
        <Stat label="Unique owners" value={stats.uniquePolicies.toString()} />
        <Stat label="Payments" value={stats.payments.toString()} />
        <Stat label="Policy rotations" value={stats.rotations.toString()} />
        <Stat label="Pause events" value={stats.pauses.toString()} />
        <Stat label="Block window" value={latestBlock ? `~${(LOOKBACK_BLOCKS / 1000).toFixed(0)}k` : "—"} />
      </div>

      {error && <p className="explorer__error">{error}</p>}

      <section className="card">
        <header>
          <h2>Recent events</h2>
          <p>
            Sorted by block height. Scoped to the latest {LOOKBACK_BLOCKS.toLocaleString()} blocks
            on Sepolia (~{Math.round((LOOKBACK_BLOCKS * 12) / 3600)}h window).
          </p>
        </header>
        {isLoading ? (
          <div className="explorer__loading">Loading on-chain events…</div>
        ) : events.length === 0 && !error ? (
          <div className="explorer__loading">
            No activity in the lookback window yet. Create a policy in the Studio to be the first.
          </div>
        ) : (
          <div className="explorer__table-wrap">
            <table className="explorer__table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Event</th>
                  <th>Owner</th>
                  <th>Counterparty</th>
                  <th>Detail</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 60).map((row) => (
                  <tr key={`${row.txHash}-${row.kind}`}>
                    <td className="mono muted">{row.blockNumber}</td>
                    <td>
                      <span className={`tag tag--${row.kind}`}>{row.kind}</span>
                    </td>
                    <td className="mono">{shorten(row.owner)}</td>
                    <td className="mono">{shorten(row.merchant ?? row.agent)}</td>
                    <td className="muted">{detailFor(row)}</td>
                    <td>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link"
                      >
                        {row.txHash.slice(0, 8)}… ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat stat--muted">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

function shorten(address?: string) {
  if (!address || !isAddress(address)) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function detailFor(row: EventRow) {
  switch (row.kind) {
    case "PaymentEvaluated":
      return `payment #${row.paymentId?.toString() ?? "?"}`;
    case "PolicyPaused":
      return row.paused ? "paused" : "resumed";
    case "MerchantUpdated":
      return row.allowed ? "added" : "removed";
    case "PolicyCreated":
      return "policy committed";
    case "PolicyRotated":
      return "limits rotated";
    case "TreasuryFunded":
      return "encrypted top-up";
    default:
      return "—";
  }
}
