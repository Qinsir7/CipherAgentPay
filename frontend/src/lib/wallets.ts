/**
 * EIP-6963 multi-wallet discovery.
 *
 * Modern browser wallets (MetaMask, Rainbow, Coinbase, Phantom, Brave, OKX,
 * Trust, …) all broadcast their presence via the `eip6963:announceProvider`
 * event. Listening to it — and dispatching a one-shot `eip6963:requestProvider`
 * — gives us the full installed set without depending on `window.ethereum`,
 * which is racy and unreliable when multiple wallets are installed.
 */

import { useEffect, useState } from "react";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
};

type AnnounceEvent = CustomEvent<Eip6963ProviderDetail>;

export function useInjectedWallets(): Eip6963ProviderDetail[] {
  const [wallets, setWallets] = useState<Eip6963ProviderDetail[]>([]);

  useEffect(() => {
    function onAnnounce(event: Event) {
      const detail = (event as AnnounceEvent).detail;
      if (!detail?.info?.uuid || !detail.provider?.request) return;
      setWallets((prev) =>
        prev.some((w) => w.info.uuid === detail.info.uuid) ? prev : [...prev, detail],
      );
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  return wallets;
}

/**
 * Best-effort fallback for legacy wallets that haven't shipped EIP-6963 yet.
 * Returned only when the discovery list is empty.
 */
export function legacyInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth?.request ? eth : null;
}
