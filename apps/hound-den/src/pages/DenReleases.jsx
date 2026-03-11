import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminReleases } from "../lib/apiClient.js";

const statuses = ["all", "draft", "submitted", "in_transcode", "live", "rejected", "hidden"];

export default function DenReleases() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminReleases({ status, q, limit: 150 });
      setRows(Array.isArray(result.releases) ? result.releases : []);
    } catch (err) {
      setError(err.message || "Failed to load releases");
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
        <p className="eyebrow">Release Management</p>
        <h1>Releases</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search title" />
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>Filter</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <ol className="status-stack">
          {rows.map((release) => (
            <li key={release.releaseId}>
              <strong>{release.title} - {release.artistName}</strong>
              <span>
                {release.type} | {release.status} | tracks: {release.trackCount} | hidden: {String(release.isHidden)}
              </span>
              <span><Link to={`/releases/${release.releaseId}`}>Open detail</Link></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
