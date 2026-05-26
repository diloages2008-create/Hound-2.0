import React, { useEffect, useMemo, useState } from "react";
import { getAdminDashboard, searchAdminEverything } from "../lib/apiClient.js";

function formatBytes(value) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(value);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function DenDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await getAdminDashboard();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const healthLabel = useMemo(() => {
    if (!data?.healthStatus) return "unknown";
    if (data.healthStatus === "on_fire") return "On Fire";
    if (data.healthStatus === "warning") return "Warning";
    return "Healthy";
  }, [data]);

  const runSearch = async () => {
    const query = searchQ.trim();
    if (!query) return;
    const result = await searchAdminEverything({ q: query });
    setSearchResult(result.results || null);
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Command Center</p>
        <h1>Platform Status: {healthLabel}</h1>
        <p>One-screen answer to: healthy right now, or on fire.</p>
      </header>

      <section className="panel">
        <div className="album-actions">
          <input value={searchQ} onChange={(event) => setSearchQ(event.target.value)} placeholder="Global admin search: artist, user, release, track, job, report" />
          <button type="button" className="secondary-button" onClick={runSearch}>Search</button>
        </div>
        {searchResult ? (
          <div className="chip-row">
            <span className="chip">Artists: {(searchResult.artists || []).length}</span>
            <span className="chip">Users: {(searchResult.users || []).length}</span>
            <span className="chip">Releases: {(searchResult.releases || []).length}</span>
            <span className="chip">Tracks: {(searchResult.tracks || []).length}</span>
            <span className="chip">Jobs: {(searchResult.jobs || []).length}</span>
            <span className="chip">Reports: {(searchResult.reports || []).length}</span>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="album-actions">
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <div className="metric-grid">
          <div className="metric-card"><small>Total Users</small><strong>{data?.metrics?.totalUsers ?? "-"}</strong></div>
          <div className="metric-card"><small>Active Listeners</small><strong>{data?.metrics?.activeListeners ?? "-"}</strong></div>
          <div className="metric-card"><small>Total Artists</small><strong>{data?.metrics?.totalArtists ?? "-"}</strong></div>
          <div className="metric-card"><small>Drafts Pending</small><strong>{data?.metrics?.draftsPendingReview ?? "-"}</strong></div>
          <div className="metric-card"><small>Releases Processing</small><strong>{data?.metrics?.releasesProcessing ?? "-"}</strong></div>
          <div className="metric-card"><small>Failed Transcodes</small><strong>{data?.metrics?.failedTranscodes ?? "-"}</strong></div>
          <div className="metric-card"><small>Recent Publishes</small><strong>{data?.metrics?.recentPublishes ?? "-"}</strong></div>
          <div className="metric-card"><small>Recent Errors</small><strong>{data?.metrics?.recentErrors ?? "-"}</strong></div>
          <div className="metric-card"><small>Storage Usage</small><strong>{formatBytes(data?.metrics?.storageUsageBytes)}</strong></div>
          <div className="metric-card"><small>Event Ingest</small><strong>{data?.metrics?.eventIngestHealth?.status ?? "-"}</strong></div>
        </div>
      </section>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Top Tracks</h2>
          <ol className="status-stack">
            {(data?.top?.tracks || []).map((row) => (
              <li key={row.trackId}><strong>{row.title}</strong><span>{row.plays} plays</span></li>
            ))}
            {!data?.top?.tracks?.length ? <li><strong>No data yet</strong></li> : null}
          </ol>
        </article>
        <article className="panel">
          <h2>Top Releases</h2>
          <ol className="status-stack">
            {(data?.top?.releases || []).map((row) => (
              <li key={row.releaseId}><strong>{row.title}</strong><span>{row.plays} plays</span></li>
            ))}
            {!data?.top?.releases?.length ? <li><strong>No data yet</strong></li> : null}
          </ol>
        </article>
        <article className="panel">
          <h2>Top Artists</h2>
          <ol className="status-stack">
            {(data?.top?.artists || []).map((row) => (
              <li key={row.artistId}><strong>{row.stageName}</strong><span>{row.plays} plays</span></li>
            ))}
            {!data?.top?.artists?.length ? <li><strong>No data yet</strong></li> : null}
          </ol>
        </article>
        <article className="panel">
          <h2>Latest Support Flags / Reports</h2>
          <ol className="status-stack">
            {(data?.latest?.reports || []).map((row) => (
              <li key={row.report_id}><strong>{row.report_category || "report"}</strong><span>{new Date(row.created_at).toLocaleString()}</span></li>
            ))}
            {!data?.latest?.reports?.length ? <li><strong>No reports yet</strong></li> : null}
          </ol>
        </article>
      </section>
    </div>
  );
}
