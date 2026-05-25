import React, { useEffect, useState } from "react";
import { createModerationFlagFromReport, listAdminReports } from "../lib/apiClient.js";

export default function DenReports() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);

  const load = async (query = q) => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminReports({ q: query, limit: 150 });
      setReports(Array.isArray(result.reports) ? result.reports : []);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const escalate = async (reportId) => {
    const reason = window.prompt("Reason to escalate this report into moderation:");
    if (!reason) return;
    await createModerationFlagFromReport(reportId, { category: "quality", reason });
    await load();
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Reports / Incidents</p>
        <h1>Incident Review</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search reports" />
          <button type="button" className="secondary-button" onClick={() => load(q)} disabled={busy}>Search</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <ol className="status-stack">
          {reports.map((report) => (
            <li key={report.report_id}>
              <strong>{report.report_category || "issue"} | {report.app_surface}</strong>
              <span>Report ID: {report.report_id}</span>
              <span>User: {report.user_id || "anonymous"} | Account: {report.account_type || "-"}</span>
              <span>Time: {new Date(report.created_at).toLocaleString()} | Route: {report.route}</span>
              <span>Platform: {report.platform || "-"} | Version: {report.app_version || "-"} | Env: {report.environment || "-"}</span>
              <span>Error: {report.error_code || "-"} {report.error_message || ""}</span>
              <span>Request: {report.failed_request_url || "-"} ({report.response_status || "-"})</span>
              <span>Linked: release {report.release_id || "-"} | track {report.track_id || "-"} | artist {report.artist_id || "-"} | job {report.worker_job_id || "-"}</span>
              <span>Description: {report.user_description || "-"}</span>
              <details>
                <summary>Breadcrumb actions</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(report.client_actions || [], null, 2)}</pre>
              </details>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => escalate(report.report_id)}>Create Moderation Flag</button>
              </div>
            </li>
          ))}
          {!reports.length && !busy ? <li><strong>No reports found.</strong></li> : null}
        </ol>
      </section>
    </div>
  );
}
