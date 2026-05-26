import React, { useEffect, useState } from "react";
import { API_BASE, API_MODE, getOperatorOverview, hasSession } from "../lib/apiClient.js";

export default function Operator() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [generatedAt, setGeneratedAt] = useState("");

  const load = async () => {
    if (!hasSession()) return;
    setBusy(true);
    setError("");
    try {
      const result = await getOperatorOverview();
      setMetrics(result.metrics || null);
      setGeneratedAt(result.generatedAt || "");
    } catch (err) {
      setError(err.message || "Failed to load operator metrics");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Operator</p>
        <h1>System Snapshot</h1>
        <p>Mode: <code>{API_MODE}</code> | Backend: <code>{API_BASE}</code></p>
      </header>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Pipeline Health</h2>
          <ol className="status-stack">
            <li><strong>Uploads Today</strong><span>{metrics?.uploadsToday ?? "-"}</span></li>
            <li><strong>Transcode Queued</strong><span>{metrics?.transcodeQueued ?? "-"}</span></li>
            <li><strong>Transcode Failed (24h)</strong><span>{metrics?.transcodeFailed24h ?? "-"}</span></li>
            <li><strong>Oldest Job Age (minutes)</strong><span>{metrics?.oldestJobAgeMinutes ?? "-"}</span></li>
            <li><strong>Play Attempts (24h)</strong><span>{metrics?.playAttempts24h ?? "-"}</span></li>
            <li><strong>Play Failures (24h)</strong><span>{metrics?.playFailures24h ?? "-"}</span></li>
          </ol>
          <div className="album-actions">
            <button type="button" className="secondary-button" onClick={load} disabled={busy || !hasSession()}>
              {busy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {generatedAt ? <p>Generated: {new Date(generatedAt).toLocaleString()}</p> : null}
          {!hasSession() ? <p>Login required.</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
