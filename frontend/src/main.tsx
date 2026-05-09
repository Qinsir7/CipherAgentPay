import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import App from "./App";
import Landing from "./pages/Landing";
import Studio from "./pages/Studio";
import Developers from "./pages/Developers";
import Explorer from "./pages/Explorer";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Landing />} />
          <Route path="app" element={<Studio />} />
          <Route path="explorer" element={<Explorer />} />
          <Route path="developers" element={<Developers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
