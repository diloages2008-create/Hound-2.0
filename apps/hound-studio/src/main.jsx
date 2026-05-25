import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { initializeStudioDiagnostics } from "./lib/diagnostics.js";

const root = createRoot(document.getElementById("root"));
initializeStudioDiagnostics();
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
