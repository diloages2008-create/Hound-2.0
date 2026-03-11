import React, { useEffect, useState } from "react";
import { listAdminModerationFlags, runAdminModerationAction } from "../lib/apiClient.js";

const statuses = ["all", "open", "in_review", "escalated", "resolved", "dismissed"];

export default function DenModeration() {
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flags, setFlags] = useState([]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminModerationFlags({ status, limit: 200 });
      setFlags(Array.isArray(result.flags) ? result.flags : []);
    } catch (err) {
      setError(err.message || "Failed to load moderation flags");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (flagId, action) => {
    const reason = window.prompt(`Reason for ${action}:`);
    if (!reason) return;
    await runAdminModerationAction(flagId, { action, reason });
    await load();
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Content Moderation</p>
        <h1>Flag Queue</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>Refresh</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <ol className="status-stack">
          {flags.map((flag) => (
            <li key={flag.flag_id}>
              <strong>{flag.category} | {flag.status}</strong>
              <span>{flag.target_type}:{flag.target_id || "-"}</span>
              <span>{flag.notes || "No notes"}</span>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => runAction(flag.flag_id, "start_review")}>Review</button>
                <button type="button" className="secondary-button" onClick={() => runAction(flag.flag_id, "escalate")}>Escalate</button>
                <button type="button" className="secondary-button" onClick={() => runAction(flag.flag_id, "hide_content")}>Hide Content</button>
                <button type="button" className="secondary-button" onClick={() => runAction(flag.flag_id, "suspend_artist")}>Suspend Artist</button>
                <button type="button" className="secondary-button" onClick={() => runAction(flag.flag_id, "resolve")}>Resolve</button>
              </div>
            </li>
          ))}
          {!flags.length && !busy ? <li><strong>No flags queued.</strong></li> : null}
        </ol>
      </section>
    </div>
  );
}
