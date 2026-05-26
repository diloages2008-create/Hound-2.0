import React, { useEffect, useState } from "react";
import { listAdminJobs, runAdminJobAction } from "../lib/apiClient.js";

const statuses = ["all", "queued", "in_progress", "failed", "completed"];

export default function DenJobs() {
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminJobs({ status, limit: 200 });
      setJobs(Array.isArray(result.jobs) ? result.jobs : []);
    } catch (err) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (jobId, action) => {
    const reason = window.prompt(`Reason for ${action}:`);
    if (!reason) return;
    await runAdminJobAction(jobId, { action, reason });
    await load();
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Queue / Job Monitoring</p>
        <h1>Transcode Jobs</h1>
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
          {jobs.map((job) => (
            <li key={job.jobId}>
              <strong>{job.status} | {job.releaseTitle}</strong>
              <span>Job {job.jobId} | retries {job.retryCount} | heartbeat {job.workerHeartbeat || "-"}</span>
              <span>Failure: {job.failureReason || "none"}</span>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => runAction(job.jobId, "retry")}>Retry</button>
                <button type="button" className="secondary-button" onClick={() => runAction(job.jobId, "cancel")}>Cancel</button>
              </div>
            </li>
          ))}
          {!jobs.length && !busy ? <li><strong>No jobs found.</strong></li> : null}
        </ol>
      </section>
    </div>
  );
}
