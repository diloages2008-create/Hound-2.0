import React, { useEffect, useState } from "react";
import { listAdminArtists, runAdminArtistAction } from "../lib/apiClient.js";

export default function DenArtists() {
  const [q, setQ] = useState("");
  const [artists, setArtists] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async (query = q) => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminArtists({ q: query, limit: 120 });
      setArtists(Array.isArray(result.artists) ? result.artists : []);
    } catch (err) {
      setError(err.message || "Failed to load artists");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const runAction = async (artistId, action) => {
    const reason = window.prompt(`Reason for ${action}:`);
    if (!reason) return;
    await runAdminArtistAction(artistId, { action, reason });
    await load();
  };

  const deleteArtist = async (artist) => {
    if (!artist?.artistId) return;
    const marker = window.prompt(`Type DELETE to permanently remove artist "${artist.displayName}" and all linked music.`);
    if (marker !== "DELETE") return;
    const reason = window.prompt("Reason for permanent artist + music deletion:");
    if (!reason) return;
    await runAdminArtistAction(artist.artistId, { action: "delete_permanent", reason });
    await load();
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Artist Management</p>
        <h1>Artists</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search artist or email" />
          <button type="button" className="secondary-button" onClick={() => load(q)} disabled={busy}>Search</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        <div className="den-list">
          {artists.map((artist) => (
            <article key={artist.artistId} className="panel" style={{ marginBottom: "12px" }}>
              <h3>{artist.displayName}</h3>
              <p>{artist.email}</p>
              <div className="chip-row">
                <span className="chip">ID: {artist.artistId}</span>
                <span className="chip">Onboarding: {artist.onboardingStatus}</span>
                <span className="chip">Verification: {artist.verificationStatus}</span>
                <span className="chip">Flags: {artist.strikesOrFlags}</span>
                <span className="chip">Releases: {artist.linkedReleases}</span>
                <span className="chip">Status: {artist.accountStatus}</span>
              </div>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => runAction(artist.artistId, "verify")}>Verify</button>
                <button type="button" className="secondary-button" onClick={() => runAction(artist.artistId, "approve_onboarding")}>Approve</button>
                <button type="button" className="secondary-button" onClick={() => runAction(artist.artistId, "reject_onboarding")}>Reject</button>
                <button type="button" className="secondary-button" onClick={() => runAction(artist.artistId, "suspend")}>Suspend</button>
                <button type="button" className="secondary-button" onClick={() => runAction(artist.artistId, "reinstate")}>Reinstate</button>
                <button type="button" className="secondary-button" onClick={() => deleteArtist(artist)}>Delete Artist + Music</button>
              </div>
            </article>
          ))}
          {!artists.length && !busy ? <p>No artists found.</p> : null}
        </div>
      </section>
    </div>
  );
}
