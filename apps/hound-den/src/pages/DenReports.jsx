import React, { useEffect, useState } from "react";
import {
  createModerationFlagFromReport,
  listAdminReports,
  runAdminReportAction
} from "../lib/apiClient.js";

const appFilters = ["all", "studio", "listener"];
const assigneeFilters = ["all", "me", "unassigned"];
const statusFilters = ["all", "new", "triaged", "investigating", "escalated", "resolved", "dismissed"];
const severityFilters = ["all", "low", "medium", "high", "critical"];
const categoryFilters = [
  "all",
  "bug",
  "crash",
  "playback_failure",
  "upload_failure",
  "ui_glitch",
  "account_auth",
  "stream_manifest",
  "other"
];

export default function DenReports() {
  const [q, setQ] = useState("");
  const [app, setApp] = useState("all");
  const [incidentStatus, setIncidentStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);

  const load = async (query = q) => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminReports({
        q: query,
        app: app === "all" ? "" : app,
        category: category === "all" ? "" : category,
        incidentStatus: incidentStatus === "all" ? "" : incidentStatus,
        severity: severity === "all" ? "" : severity,
        assignee: assignee === "all" ? "" : assignee,
        limit: 150
      });
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

  const runAction = async (reportId, action, options = {}) => {
    const reason = window.prompt(`Reason for ${action}:`);
    if (!reason) return;
    await runAdminReportAction(reportId, { action, reason, ...options });
    await load();
  };

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
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search report, release, track, error, job ID" />
          <select value={app} onChange={(event) => setApp(event.target.value)}>{appFilters.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>{categoryFilters.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value)}>{statusFilters.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>{severityFilters.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>{assigneeFilters.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <button type="button" className="secondary-button" onClick={() => load(q)} disabled={busy}>Apply Filters</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <ol className="status-stack">
          {reports.map((report) => (
            <li key={report.report_id}>
              <strong>{report.report_category || "issue"} | {report.app_surface} | {report.incident_status || "new"} | {report.incident_severity || "medium"}</strong>
              <span>Report ID: {report.report_id}</span>
              <span>User: {report.user_id || "anonymous"} | Account: {report.account_type || "-"}</span>
              <span>Assigned: {report.incident_assignee_user_id || "unassigned"}</span>
              <span>Time: {new Date(report.created_at).toLocaleString()} | Route: {report.route}</span>
              <span>Platform: {report.platform || "-"} | Version: {report.app_version || "-"} | Env: {report.environment || "-"}</span>
              <span>Error: {report.error_code || "-"} {report.error_message || ""}</span>
              <span>Request: {report.failed_request_url || "-"} ({report.response_status || "-"})</span>
              <span>Linked: release {report.release_id || "-"} | track {report.track_id || "-"} | artist {report.artist_id || "-"} | job {report.worker_job_id || "-"}</span>
              <span>Description: {report.user_description || "-"}</span>
              <span>Reason: {report.incident_reason || "-"}</span>
              <span>Resolution: {report.incident_resolution_notes || "-"}</span>
              <details>
                <summary>Breadcrumb actions</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(report.client_actions || [], null, 2)}</pre>
              </details>
              <details>
                <summary>Stack trace</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{report.stack_trace || "None"}</pre>
              </details>
              <details>
                <summary>Incident action history</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(report.incident_action_history || [], null, 2)}</pre>
              </details>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "assign_to_me")}>Assign To Me</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "triage")}>Triage</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "investigate")}>Investigate</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "escalate", { severity: "high" })}>Escalate</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "resolve")}>Resolve</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "dismiss")}>Dismiss</button>
                <button type="button" className="secondary-button" onClick={() => runAction(report.report_id, "reopen")}>Reopen</button>
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
