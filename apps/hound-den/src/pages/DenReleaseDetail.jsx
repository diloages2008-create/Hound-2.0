import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAdminRelease, runAdminReleaseAction, runAdminTrackAction } from "../lib/apiClient.js";

const actionButtons = [
  ["approve", "Approve"],
  ["reject", "Reject"],
  ["hide", "Hide"],
  ["unhide", "Unhide"],
  ["unpublish", "Unpublish"],
  ["republish", "Republish"],
  ["feature", "Feature"],
  ["unfeature", "Unfeature"]
];

export default function DenReleaseDetail() {
  const { releaseId } = useParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async () => {
    if (!releaseId) return;
    setBusy(true);
    setError("");
    try {
      const result = await getAdminRelease(releaseId);
      setDetail(result);
    } catch (err) {
      setError(err.message || "Failed to load release detail");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [releaseId]);

  const runAction = async (action) => {
    if (!releaseId) return;
    const reason = window.prompt(`Reason for ${action}:`);
    if (!reason) return;
    await runAdminReleaseAction(releaseId, { action, reason });
    await load();
  };

  const runSetPriority = async () => {
    if (!releaseId) return;
    const priorityRaw = window.prompt("Set priority rank (number):");
    if (priorityRaw === null) return;
    const priorityRank = Number(priorityRaw);
    if (!Number.isFinite(priorityRank)) return;
    const reason = window.prompt("Reason for priority change:");
    if (!reason) return;
    await runAdminReleaseAction(releaseId, { action: "set_priority", priorityRank, reason });
    await load();
  };

  const deleteReleasePermanently = async () => {
    if (!releaseId || !release?.title) return;
    const marker = window.prompt(`Type DELETE to permanently remove release "${release.title}" and all tracks.`);
    if (marker !== "DELETE") return;
    const reason = window.prompt("Reason for permanent release deletion:");
    if (!reason) return;
    await runAdminReleaseAction(releaseId, { action: "delete_permanent", reason });
    window.location.href = "/releases";
  };

  const deleteTrackPermanently = async (trackId, title) => {
    if (!trackId) return;
    const confirmText = window.prompt(`Type DELETE to permanently remove track "${title}" (${trackId}).`);
    if (confirmText !== "DELETE") return;
    const reason = window.prompt("Reason for permanent track deletion:");
    if (!reason) return;
    await runAdminTrackAction(trackId, { action: "delete_permanent", reason });
    await load();
  };

  const release = detail?.release;

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Release Detail</p>
        <h1>{release?.title || "Release"}</h1>
        <p>{release?.artistName || "-"}</p>
      </header>
      {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
      <section className="panel">
        <div className="chip-row">
          <span className="chip">ID: {release?.releaseId || "-"}</span>
          <span className="chip">Status: {release?.status || "-"}</span>
          <span className="chip">Type: {release?.type || "-"}</span>
          <span className="chip">Published: {release?.publishDate ? new Date(release.publishDate).toLocaleString() : "-"}</span>
          <span className="chip">Hidden: {String(release?.isHidden || false)}</span>
          <span className="chip">Featured: {String(release?.isFeatured || false)}</span>
          <span className="chip">Priority: {release?.priorityRank ?? "-"}</span>
          <span className="chip">Cover: {release?.coverStatus || "-"}</span>
        </div>
        <div className="album-actions">
          {actionButtons.map(([action, label]) => (
            <button key={action} type="button" className="secondary-button" onClick={() => runAction(action)} disabled={busy}>{label}</button>
          ))}
          <button type="button" className="secondary-button" onClick={runSetPriority} disabled={busy}>Set Priority</button>
          <button type="button" className="secondary-button" onClick={deleteReleasePermanently} disabled={busy}>Delete Release + Tracks</button>
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>{busy ? "Refreshing..." : "Refresh"}</button>
        </div>
      </section>
      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Tracks / Asset Health</h2>
          <ol className="status-stack">
            {(detail?.tracks || []).map((track) => (
              <li key={track.trackId}>
                <strong>{track.trackNumber}. {track.title}</strong>
                <span>Duration: {track.durationSec ?? "-"} | HLS: {track.hlsManifestStatus} | Asset: {track.audioAssetHealth}</span>
                <div className="album-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => deleteTrackPermanently(track.trackId, track.title)}
                    disabled={busy}
                  >
                    Delete Permanently
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </article>
        <article className="panel">
          <h2>Processing History</h2>
          <ol className="status-stack">
            {(detail?.processingHistory || []).map((job) => (
              <li key={job.job_id}>
                <strong>{job.status}</strong>
                <span>Job {job.job_id} | Attempts {job.attempts}/{job.max_attempts}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="panel">
          <h2>Admin Action History</h2>
          <ol className="status-stack">
            {(detail?.adminActionHistory || []).map((event) => (
              <li key={event.audit_id}>
                <strong>{event.action}</strong>
                <span>{event.reason || "no reason"} | {new Date(event.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}
