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
    coverAssetId: "",
    submitted: false,
    published: false
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const validateReleaseFields = () => {
    if (!form.title.trim()) throw new Error("Title is required.");
    if (!form.genre.trim()) throw new Error("Genre is required.");
  };

  const validateRequired = () => {
    validateReleaseFields();
    if (!masterFile && !pipeline.masterAssetId) throw new Error("Master audio is required.");
    if (!coverFile && !pipeline.coverAssetId) throw new Error("Cover image is required.");
  };

  const ensureRelease = async () => {
    if (pipeline.releaseId) return pipeline.releaseId;
    const result = await createRelease({
      title: form.title,
      releaseType: form.releaseType,
      genre: form.genre,
      moodTags: form.moodTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      about: form.about,
      releaseDate: form.releaseDate || null
    });
    setPipeline((prev) => ({ ...prev, releaseId: result.releaseId }));
    return result.releaseId;
  };

  const uploadFileWithIntent = async (releaseId, type) => {
    if (type === "master") {
      if (pipeline.masterAssetId) return pipeline.masterAssetId;
      if (!masterFile) throw new Error("Choose a master audio file first.");
      const intent = await createMasterUploadIntent(releaseId, {
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
      return intent.assetId;
    }

    if (pipeline.coverAssetId) return pipeline.coverAssetId;
    if (!coverFile) throw new Error("Choose a cover image file first.");
    const intent = await createCoverUploadIntent(releaseId, {
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
    return intent.assetId;
  };

  const handleCreateRelease = () =>
    run(async () => {
      validateReleaseFields();
      const releaseId = await ensureRelease();
      return `Release created: ${releaseId}`;
    });

  const handleCreateMasterIntent = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Create release first.");
      const masterAssetId = await uploadFileWithIntent(pipeline.releaseId, "master");
      return `Master upload completed: ${masterAssetId}`;
    });

  const handleCreateCoverIntent = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Create release first.");
      const coverAssetId = await uploadFileWithIntent(pipeline.releaseId, "cover");
      return `Cover upload completed: ${coverAssetId}`;
    });

  const handleSubmitAndPreparePublish = () =>
    run(async () => {
      validateRequired();
      const releaseId = await ensureRelease();
      const [masterAssetId, coverAssetId] = await Promise.all([
        uploadFileWithIntent(releaseId, "master"),
        uploadFileWithIntent(releaseId, "cover")
      ]);
      const result = await submitRelease(releaseId, {
        coverAssetId,
        tracks: [
          {
            title: `${form.title} - Track 1`,
            trackNumber: 1,
            masterAssetId,
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
      setPipeline((prev) => ({ ...prev, releaseId, masterAssetId, coverAssetId, submitted: true, published: false }));
      return `Release submitted: ${result.releaseId} (${result.status}). Publish is now enabled.`;
    });

  const handlePublishRelease = () =>
    run(async () => {
      if (!pipeline.releaseId) throw new Error("Release required.");
      const maxAttempts = 45;
      for (let i = 0; i < maxAttempts; i += 1) {
        try {
          const result = await publishRelease(pipeline.releaseId);
          setPipeline((prev) => ({ ...prev, published: true }));
          return `Release published: ${result.releaseId} (${result.status})`;
        } catch (err) {
          const msg = String(err.message || "");
          const waiting =
            msg.includes("track not ready for publish") ||
            msg.includes("transcode jobs are not fully completed") ||
            msg.includes("release not ready to publish");
          if (!waiting) throw err;
          setMessage(`Transcode still running... retrying publish (${i + 1}/${maxAttempts})`);
          await sleep(8000);
        }
      }
      throw new Error("Timed out waiting for transcode to finish. Try Publish again in a minute.");
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
            <li><strong>Submitted</strong><span>{pipeline.submitted ? "yes" : "no"}</span></li>
            <li><strong>Published</strong><span>{pipeline.published ? "yes" : "no"}</span></li>
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
            {!pipeline.submitted ? (
              <button type="button" className="primary-button" onClick={handleSubmitAndPreparePublish} disabled={busy || !getToken()}>
                4) Submit (Create + Upload + Submit)
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={handlePublishRelease} disabled={busy || !getToken()}>
                5) Publish
              </button>
            )}
          </div>

          {!getToken() ? <p>Login in Profile first to run pipeline.</p> : null}
          {message ? <p>{message}</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>
      </section>
    </div>
  );
}
