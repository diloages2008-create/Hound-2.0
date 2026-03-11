import React, { useState } from "react";
import { loginAdmin } from "../lib/apiClient.js";

export default function DenAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await loginAdmin({ email, password, rememberMe });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Admin Access</p>
        <h1>HOUND DEN</h1>
        <p>Role-gated web command center for Studio + Listener operations.</p>
      </header>
      <section className="panel-grid">
        <article className="panel">
          <div className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Remember session
            </label>
          </div>
          <div className="album-actions">
            <button type="button" className="primary-button" onClick={run} disabled={busy}>
              {busy ? "Signing in..." : "Admin Login"}
            </button>
          </div>
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
