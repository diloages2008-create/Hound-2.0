import React, { useEffect, useState } from "react";
import { catalogAlbums } from "../data/studioData.js";
import { API_BASE, getToken, listStudioReleases, deleteStudioRelease } from "../lib/apiClient.js";

function toCard(release) {
  return {
    id: release.releaseId,
    title: release.title,
    year: release.releaseDate ? new Date(release.releaseDate).getFullYear() : new Date(release.createdAt || Date.now()).getFullYear(),
    genre: release.genre || "Unknown",
    moodTags: Array.isArray(release.moodTags) ? release.moodTags : [],
    tracks: release.releaseType === "single" ? 1 : null,
    status: release.status || "draft",
    credits: ["Credits pending upload pipeline"]
  };
}

export default function Library() {
  const apiMode = import.meta.env.VITE_HOUND_API_MODE || "live";
  const [albums, setAlbums] = useState(catalogAlbums);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState("");

  const loadCatalog = async () => {
    if (!getToken()) return;
    setBusy(true);
    setError("");
    try {
      const result = await listStudioReleases();
      const releases = Array.isArray(result.releases) ? result.releases : [];
      setAlbums(releases.length ? releases.map(toCard) : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleDeleteRelease = async (releaseId) => {
    if (!releaseId) return;
    const ok = window.confirm("Delete this release and its tracks? This cannot be undone.");
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await deleteStudioRelease(releaseId);
      setAlbums((prev) => prev.filter((album) => album.id !== releaseId));
      setMenuId("");
    } catch (err) {
      setError(err.message || "Failed to delete release.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Catalog Integrity</p>
        <h1>Album Library</h1>
        <p>Mode: <code>{apiMode}</code> | Backend: <code>{API_BASE}</code></p>
      </header>

      <div className="album-actions">
        <button type="button" className="secondary-button" onClick={loadCatalog} disabled={busy || !getToken()}>
          {busy ? "Loading..." : "Refresh from API"}
        </button>
      </div>
      {!getToken() ? <p>Login in Profile first. Showing local sample catalog.</p> : null}
      {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}

      <section className="panel-grid">
        {albums.map((album) => (
          <article key={album.id} className="panel album-card">
            <div className="album-top">
              <div className="cover-placeholder">{album.title.slice(0, 2).toUpperCase()}</div>
              <div>
                <h2>{album.title}</h2>
                <p>
                  {album.year} | {album.genre} | {album.tracks ?? "?"} tracks
                </p>
                <div className="chip-row">
                  {album.moodTags.map((mood) => (
                    <span key={mood} className="chip">
                      {mood}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`status-pill status-${album.status}`}>{album.status}</span>
              <div style={{ marginLeft: "8px", position: "relative" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setMenuId((prev) => (prev === album.id ? "" : album.id))}
                  style={{ minWidth: "36px", padding: "6px 10px" }}
                >
                  ...
                </button>
                {menuId === album.id ? (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "42px",
                      background: "#fff",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 10,
                      minWidth: "180px"
                    }}
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: "100%", textAlign: "left", borderRadius: 0 }}
                      onClick={() => {
                        navigator.clipboard?.writeText(album.id);
                        setMenuId("");
                      }}
                    >
                      Copy Release ID
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: "100%", textAlign: "left", borderRadius: 0, color: "#a40000" }}
                      onClick={() => handleDeleteRelease(album.id)}
                      disabled={busy}
                    >
                      Delete Release
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="credit-block">
              {album.credits.map((credit) => (
                <p key={credit}>{credit}</p>
              ))}
            </div>
          </article>
        ))}
        {albums.length === 0 ? <p>No releases found yet.</p> : null}
      </section>
    </div>
  );
}
