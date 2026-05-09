import { Outlet, useLocation } from "react-router-dom";

import Nav from "./components/Nav";
import Footer from "./components/Footer";

export default function App() {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/app");

  return (
    <div className={`site ${isStudio ? "site--studio" : ""}`}>
      <Nav />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
