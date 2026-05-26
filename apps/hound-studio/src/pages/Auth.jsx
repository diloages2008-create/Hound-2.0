import React, { useState } from "react";
import { loginArtist } from "../lib/apiClient.js";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await loginArtist({ email, password, rememberMe });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Welcome</p>
        <h1>Hound Studio</h1>
        <p>Closed beta mode. Approved users only.</p>
        <p>Admin access is available in the separate HOUND DEN app.</p>
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
              Remember me
            </label>
          </div>

          <div className="album-actions">
            <button type="button" className="primary-button" onClick={run} disabled={busy}>
              {busy ? "Please wait..." : "Login"}
            </button>
          </div>

          {message ? <p>{message}</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
