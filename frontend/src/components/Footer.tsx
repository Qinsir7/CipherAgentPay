import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__col">
          <p className="footer__brand">
            <strong>CipherAgent</strong> Pay
          </p>
          <p className="footer__tagline">
            The encrypted policy layer for autonomous AI agent treasuries.
          </p>
        </div>

        <div className="footer__col">
          <p className="footer__heading">Product</p>
          <Link to="/">Protocol</Link>
          <Link to="/app">Studio</Link>
          <Link to="/explorer">Explorer</Link>
        </div>

        <div className="footer__col">
          <p className="footer__heading">Builders</p>
          <Link to="/developers">SDK</Link>
          <a
            href="https://github.com/Qinsir7/CipherAgentPay"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a href="https://docs.zama.ai/protocol" target="_blank" rel="noreferrer">
            Zama Docs
          </a>
        </div>

        <div className="footer__col">
          <p className="footer__heading">Standards</p>
          <a href="https://eips.ethereum.org/EIPS/eip-7984" target="_blank" rel="noreferrer">
            ERC-7984
          </a>
          <a href="https://eips.ethereum.org/EIPS/eip-712" target="_blank" rel="noreferrer">
            EIP-712
          </a>
          <a
            href="https://docs.zama.ai/protocol/relayer-sdk-guides"
            target="_blank"
            rel="noreferrer"
          >
            Relayer SDK
          </a>
        </div>
      </div>
      <div className="footer__legal">
        <span>© {new Date().getFullYear()} CipherAgent Pay · Built on Zama FHEVM</span>
        <span>Open source · BSD-3-Clause-Clear</span>
      </div>
    </footer>
  );
}
