import React, { useEffect, useState } from "react";
import { listAdminAuditEvents } from "../lib/apiClient.js";

export default function DenAudit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminAuditEvents({ limit: 200 });
      setEvents(Array.isArray(result.events) ? result.events : []);
    } catch (err) {
      setError(err.message || "Failed to load audit log");
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
        <p className="eyebrow">Admin Activity Log</p>
        <h1>Audit Trail</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <ol className="status-stack">
          {events.map((event) => (
            <li key={event.auditId}>
              <strong>{event.action}</strong>
              <span>{event.actorEmail || event.actorUserId} ({event.actorAdminScope || "admin"})</span>
              <span>{event.entityType}:{event.entityId || "-"}</span>
              <span>Reason: {event.reason || "-"}</span>
              <span>{new Date(event.createdAt).toLocaleString()}</span>
            </li>
          ))}
          {!events.length && !busy ? <li><strong>No audit events yet.</strong></li> : null}
        </ol>
      </section>
    </div>
  );
}
