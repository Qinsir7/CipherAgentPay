import { Link, NavLink } from "react-router-dom";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">
          <img src="/logo-64.png" alt="" className="nav__logo" width={36} height={36} />
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
