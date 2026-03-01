import React, { useState } from "react";
import { loginArtist, signupArtist } from "../lib/apiClient.js";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        await loginArtist({ email, password, rememberMe });
        window.location.href = "/dashboard";
        return;
      }
      await signupArtist({
        email,
        password,
        stageName,
        ownsMasters: true,
        rightsStatement: "I confirm I own or control rights for uploaded material.",
        rememberMe
      });
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
        <p>{mode === "login" ? "Log in to continue." : "Create your artist account."}</p>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <div className="album-actions">
            <button
              type="button"
              className={mode === "login" ? "primary-button" : "secondary-button"}
              onClick={() => setMode("login")}
              disabled={busy}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "signup" ? "primary-button" : "secondary-button"}
              onClick={() => setMode("signup")}
              disabled={busy}
            >
              Sign Up
            </button>
          </div>

          <div className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {mode === "signup" ? (
              <label>
                Stage Name
                <input type="text" value={stageName} onChange={(event) => setStageName(event.target.value)} />
              </label>
            ) : null}
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
              {busy ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </div>

          {message ? <p>{message}</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
