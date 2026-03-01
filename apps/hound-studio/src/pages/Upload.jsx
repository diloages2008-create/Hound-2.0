import React, { useState } from "react";
import {
  API_BASE,
  API_MODE,
  createRelease,
  createMasterUploadIntent,
  createCoverUploadIntent,
  completeUpload,
  submitRelease,
  publishRelease,
  getToken
} from "../lib/apiClient.js";

const genreOptions = ["Alt Soul", "Indie Rock", "Electronic", "Jazz", "R&B"];

export default function Upload() {
  const [form, setForm] = useState({
    title: "Night Lines",
    releaseType: "album",
    genre: "Alt Soul",
    moodTags: "Late Night, Warm, Minimal",
    about: "Album-first release with full credits and intentional sequencing.",
    releaseDate: ""
  });
  const [pipeline, setPipeline] = useState({
    releaseId: "",
    masterAssetId: "",
    coverAssetId: ""
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [masterFile, setMasterFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const msg = await fn();
      setMessage(msg || "Done.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRelease = () =>
    run(async () => {
      const result = await createRelease({
        title: form.title,
        releaseType: form.releaseType,
        genre: form.genre,
        moodTags: form.moodTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        about: form.about,
        releaseDate: form.releaseDate || null
      });
      setPipeline((prev) => ({ ...prev, releaseId: result.releaseId }));
      return `Release created: ${result.releaseId} (${result.status})`;
    });

  const handleCreateMasterIntent = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Create release first.");
      if (!masterFile) throw new Error("Choose a master audio file first.");
      const intent = await createMasterUploadIntent(pipeline.releaseId, {
        fileName: masterFile.name,
        contentType: masterFile.type || "audio/wav"
      });
      const upload = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": masterFile.type || "application/octet-stream" },
        body: masterFile
      });
      if (!upload.ok) throw new Error("Failed to upload master file.");
      await completeUpload(intent.assetId, { byteSize: masterFile.size });
      setPipeline((prev) => ({ ...prev, masterAssetId: intent.assetId }));
      return `Master intent completed: ${intent.assetId}`;
    });

  const handleCreateCoverIntent = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Create release first.");
      if (!coverFile) throw new Error("Choose a cover image file first.");
      const intent = await createCoverUploadIntent(pipeline.releaseId, {
        fileName: coverFile.name,
        contentType: coverFile.type || "image/jpeg"
      });
      const upload = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "application/octet-stream" },
        body: coverFile
      });
      if (!upload.ok) throw new Error("Failed to upload cover file.");
      await completeUpload(intent.assetId, { byteSize: coverFile.size });
      setPipeline((prev) => ({ ...prev, coverAssetId: intent.assetId }));
      return `Cover intent completed: ${intent.assetId}`;
    });

  const handleSubmitRelease = () =>
    run(async () => {
      if (!pipeline.releaseId || !pipeline.masterAssetId) throw new Error("Release + master asset required.");
      const result = await submitRelease(pipeline.releaseId, {
        coverAssetId: pipeline.coverAssetId || null,
        tracks: [
          {
            title: `${form.title} - Track 1`,
            trackNumber: 1,
            masterAssetId: pipeline.masterAssetId,
            durationSec: 212,
            loudnessLUFS: -14.2,
            lyrics: "[Verse 1] ...",
            credits: [
              { personName: "Rae Haven", role: "Writer" },
              { personName: "S. Rivera", role: "Producer" }
            ]
          }
        ]
      });
      return `Release submitted: ${result.releaseId} (${result.status})`;
    });

  const handlePublishRelease = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Release required.");
      const result = await publishRelease(pipeline.releaseId);
      return `Release published: ${result.releaseId} (${result.status})`;
    });

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Step 2</p>
        <h1>Upload Music</h1>
        <p>Mode: <code>{API_MODE}</code> | Backend: <code>{API_BASE}</code></p>
      </header>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Release Payload</h2>
          <div className="form-grid">
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              Release Type
              <select
                value={form.releaseType}
                onChange={(event) => setForm((prev) => ({ ...prev, releaseType: event.target.value }))}
              >
                <option value="album">Album</option>
                <option value="ep">EP</option>
                <option value="single">Single</option>
              </select>
            </label>
            <label>
              Genre
              <select
                value={form.genre}
                onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
              >
                {genreOptions.map((genre) => (
                  <option key={genre}>{genre}</option>
                ))}
              </select>
            </label>
            <label>
              Mood Tags (comma-separated)
              <input
                type="text"
                value={form.moodTags}
                onChange={(event) => setForm((prev) => ({ ...prev, moodTags: event.target.value }))}
              />
            </label>
            <label className="wide">
              About Album
              <textarea
                value={form.about}
                onChange={(event) => setForm((prev) => ({ ...prev, about: event.target.value }))}
              />
            </label>
            <label>
              Release Date
              <input
                type="date"
                value={form.releaseDate}
                onChange={(event) => setForm((prev) => ({ ...prev, releaseDate: event.target.value }))}
              />
            </label>
          </div>
        </article>

        <article className="panel">
          <h2>Pipeline Actions</h2>
          <div className="form-grid">
            <label className="wide">
              Master Audio File
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg,.opus"
                onChange={(event) => setMasterFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="wide">
              Cover Image File
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
              />
            </label>
          </div>
          <ol className="status-stack">
            <li><strong>Release</strong><span>{pipeline.releaseId || "not created"}</span></li>
            <li><strong>Master Asset</strong><span>{pipeline.masterAssetId || "none"}</span></li>
            <li><strong>Cover Asset</strong><span>{pipeline.coverAssetId || "none"}</span></li>
          </ol>

          <div className="album-actions">
            <button type="button" className="primary-button" onClick={handleCreateRelease} disabled={busy || !getToken()}>
              1) Create Release
            </button>
            <button type="button" className="secondary-button" onClick={handleCreateMasterIntent} disabled={busy || !getToken()}>
              2) Upload Master
            </button>
            <button type="button" className="secondary-button" onClick={handleCreateCoverIntent} disabled={busy || !getToken()}>
              3) Upload Cover
            </button>
            <button type="button" className="secondary-button" onClick={handleSubmitRelease} disabled={busy || !getToken()}>
              4) Submit Release
            </button>
            <button type="button" className="primary-button" onClick={handlePublishRelease} disabled={busy || !getToken()}>
              5) Publish
            </button>
          </div>

          {!getToken() ? <p>Login in Profile first to run pipeline.</p> : null}
          {message ? <p>{message}</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
