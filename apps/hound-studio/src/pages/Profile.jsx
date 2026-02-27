import React, { useState } from "react";
import { artistProfile } from "../data/studioData.js";
import {
  API_BASE,
  API_MODE,
  getToken,
  getAuthMe,
  loginArtist,
  logout,
  setToken,
  signupArtist,
  getStudioProfile,
  updateStudioProfile
} from "../lib/apiClient.js";

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Profile() {
  const apiMode = API_MODE;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rightsStatement, setRightsStatement] = useState(
    "I confirm I own the masters, or have explicit rights to distribute this material on Hound."
  );
  const [profile, setProfile] = useState({
    stageName: artistProfile.stageName,
    bio: artistProfile.bio,
    influences: artistProfile.influences.join(", "),
    credits: artistProfile.credits.join(", "),
    instagram: artistProfile.socials.instagram,
    tiktok: artistProfile.socials.tiktok,
    website: artistProfile.socials.website
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await signupArtist({
        email,
        password,
        stageName: profile.stageName,
        ownsMasters: true,
        rightsStatement
      });
      setMessage(`Artist created: ${result.artistId}. Login to get access token.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await loginArtist({ email, password });
      setMessage(`Logged in. Token saved. User: ${result.userId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLoadProfile = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await getStudioProfile();
      setProfile({
        stageName: result.stageName || "",
        bio: result.bio || "",
        influences: (result.influences || []).join(", "),
        credits: (result.credits || []).join(", "),
        instagram: result.socials?.instagram || "",
        tiktok: result.socials?.tiktok || "",
        website: result.socials?.website || ""
      });
      setMessage("Profile loaded from API.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWhoAmI = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const me = await getAuthMe();
      setMessage(`Session user: ${me.userId} (${me.role || "unknown"})`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await updateStudioProfile({
        stageName: profile.stageName,
        bio: profile.bio,
        influences: splitList(profile.influences),
        credits: splitList(profile.credits),
        socials: {
          instagram: profile.instagram,
          tiktok: profile.tiktok,
          website: profile.website
        }
      });
      setMessage(`Profile saved for ${result.stageName}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">Step 1</p>
        <h1>Artist Profile</h1>
        <p>Mode: <code>{apiMode}</code> | Backend: <code>{API_BASE}</code></p>
      </header>

      <section className="panel-grid panel-grid-double">
        <article className="panel">
          <h2>Auth</h2>
          <div className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="wide">
              Rights Attestation
              <textarea value={rightsStatement} onChange={(event) => setRightsStatement(event.target.value)} />
            </label>
          </div>
          <div className="album-actions">
            <button type="button" className="secondary-button" onClick={handleSignup} disabled={busy}>
              Sign Up Artist
            </button>
            <button type="button" className="primary-button" onClick={handleLogin} disabled={busy}>
              Login
            </button>
            <button type="button" className="secondary-button" onClick={handleLoadProfile} disabled={busy || !getToken()}>
              Load Profile
            </button>
            <button type="button" className="secondary-button" onClick={handleWhoAmI} disabled={busy || !getToken()}>
              Who Am I
            </button>
            <button type="button" className="secondary-button" onClick={() => logout()}>
              Logout
            </button>
            <button type="button" className="secondary-button" onClick={() => setToken("")}>
              Clear Token
            </button>
          </div>
          {message ? <p>{message}</p> : null}
          {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}
        </article>

        <article className="panel">
          <h2>Public Story</h2>
          <div className="form-grid">
            <label>
              Stage Name
              <input
                type="text"
                value={profile.stageName}
                onChange={(event) => setProfile((prev) => ({ ...prev, stageName: event.target.value }))}
              />
            </label>
            <label className="wide">
              Bio
              <textarea
                value={profile.bio}
                onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
              />
            </label>
            <label>
              Influences (comma-separated)
              <input
                type="text"
                value={profile.influences}
                onChange={(event) => setProfile((prev) => ({ ...prev, influences: event.target.value }))}
              />
            </label>
            <label>
              Credits (comma-separated)
              <input
                type="text"
                value={profile.credits}
                onChange={(event) => setProfile((prev) => ({ ...prev, credits: event.target.value }))}
              />
            </label>
            <label>
              Instagram
              <input
                type="text"
                value={profile.instagram}
                onChange={(event) => setProfile((prev) => ({ ...prev, instagram: event.target.value }))}
              />
            </label>
            <label>
              TikTok
              <input
                type="text"
                value={profile.tiktok}
                onChange={(event) => setProfile((prev) => ({ ...prev, tiktok: event.target.value }))}
              />
            </label>
            <label className="wide">
              Website
              <input
                type="text"
                value={profile.website}
                onChange={(event) => setProfile((prev) => ({ ...prev, website: event.target.value }))}
              />
            </label>
          </div>
          <button type="button" className="primary-button" onClick={handleSaveProfile} disabled={busy || !getToken()}>
            Save Profile
          </button>
        </article>
      </section>
    </div>
  );
}
