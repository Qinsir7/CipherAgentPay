import { Link, NavLink } from "react-router-dom";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">
          <span className="nav__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="4" y="9" width="16" height="11" rx="2" />
              <path d="M8 9V6a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="14.5" r="1.4" />
            </svg>
          </span>
          <span className="nav__brand-text">
            <strong>CipherAgent</strong>
            <span>Pay</span>
          </span>
        </Link>

        <nav className="nav__links">
          <NavLink to="/" end className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`}>
            Protocol
          </NavLink>
          <NavLink to="/explorer" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`}>
            Explorer
          </NavLink>
          <NavLink to="/developers" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`}>
            Developers
          </NavLink>
        </nav>

        <div className="nav__cta">
          <a
            href="https://github.com/Qinsir7/CipherAgentPay"
            target="_blank"
            rel="noreferrer"
            className="nav__ghost"
          >
            GitHub
          </a>
          <NavLink to="/app" className="nav__primary">
            Launch Studio
          </NavLink>
        </div>
      </div>
    </header>
  );
}
