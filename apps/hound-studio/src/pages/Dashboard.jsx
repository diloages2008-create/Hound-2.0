import React, { useEffect, useMemo, useState } from "react";
import {
  onboardingChecklist,
  analyticsSnapshot,
  featuredCollections
} from "../data/studioData.js";
import { API_BASE, getToken, listStudioReleases } from "../lib/apiClient.js";

const metrics = [
  { label: "Plays", value: analyticsSnapshot.plays.toLocaleString() },
  { label: "Completion", value: `${analyticsSnapshot.completionRate}%` },
  { label: "Saves", value: analyticsSnapshot.saves.toLocaleString() },
  { label: "Followers", value: analyticsSnapshot.followers.toLocaleString() },
  { label: "Est. Revenue", value: `$${analyticsSnapshot.estRevenue.toFixed(2)}` }
];

export default function Dashboard() {
  const apiMode = import.meta.env.VITE_HOUND_API_MODE || "live";
  const [releases, setReleases] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadReleases = async () => {
    if (!getToken()) return;
    setBusy(true);
    setError("");
    try {
      const result = await listStudioReleases();
      setReleases(Array.isArray(result.releases) ? result.releases : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, []);

  const releaseSummary = useMemo(() => {
    const total = releases.length;
    const live = releases.filter((item) => item.status === "live").length;
    const draft = releases.filter((item) => item.status === "draft").length;
    return { total, live, draft };
  }, [releases]);

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Artist Experience</p>
        <h1>Studio Dashboard</h1>
        <p>Mode: <code>{apiMode}</code> | Backend: <code>{API_BASE}</code></p>
      </header>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Onboarding Status</h2>
          <ul className="checklist">
            {onboardingChecklist.map((item) => (
              <li key={item.id} className={item.done ? "done" : "pending"}>
                <span>{item.done ? "Complete" : "Pending"}</span>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Behavior Signals</h2>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Catalog Snapshot</h2>
          <div className="metric-grid">
            <div className="metric-card"><small>Total Releases</small><strong>{releaseSummary.total}</strong></div>
            <div className="metric-card"><small>Live</small><strong>{releaseSummary.live}</strong></div>
            <div className="metric-card"><small>Draft</small><strong>{releaseSummary.draft}</strong></div>
          </div>
          <div className="album-actions">
            <button type="button" className="secondary-button" onClick={loadReleases} disabled={busy || !getToken()}>
              {busy ? "Refreshing..." : "Refresh Catalog"}
            </button>
          </div>
          {!getToken() ? <p>Login in Profile to load catalog stats.</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>

        {featuredCollections.map((collection) => (
          <article key={collection.key} className="panel">
            <h2>{collection.label}</h2>
            <p>{collection.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
