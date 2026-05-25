import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createLibraryProvider, PROVIDER_MODE } from "./libraryProvider.js";

const NAV = [
  { key: "now", label: "Now Playing" },
  { key: "favorites", label: "Favorites" },
  { key: "archive", label: "Archive" },
  { key: "settings", label: "Settings" }
];

const ICON = {
  prev: "⏮",
  play: "▶",
  pause: "⏸",
  next: "⏭",
  starOn: "★",
  starOff: "☆",
  mute: "🔇",
  volume: "🔊"
};

const initialTransport = {
  timeline: [],
  currentIndex: -1,
  currentTrackId: null
};

function transportReducer(state, action) {
  switch (action.type) {
    case "LOAD_INITIAL_TRACK": {
      if (!action.trackId) return state;
      return { timeline: [action.trackId], currentIndex: 0, currentTrackId: action.trackId };
    }
    case "GO_PREVIOUS": {
      if (state.currentIndex <= 0) return state;
      const nextIndex = state.currentIndex - 1;
      return { ...state, currentIndex: nextIndex, currentTrackId: state.timeline[nextIndex] || null };
    }
    case "GO_NEXT_EXISTING": {
      if (state.currentIndex >= state.timeline.length - 1) return state;
      const nextIndex = state.currentIndex + 1;
      return { ...state, currentIndex: nextIndex, currentTrackId: state.timeline[nextIndex] || null };
    }
    case "APPEND_RECOMMENDED_TRACK":
    case "BRANCH_TO_SELECTED_TRACK": {
      if (!action.trackId) return state;
      const branch = state.timeline.slice(0, state.currentIndex + 1);
      branch.push(action.trackId);
      return { timeline: branch, currentIndex: branch.length - 1, currentTrackId: action.trackId };
    }
    case "START_NEW_TIMELINE_WITH_SELECTED_TRACK": {
      if (!action.trackId) return state;
      return { timeline: [action.trackId], currentIndex: 0, currentTrackId: action.trackId };
    }
    default:
      return state;
  }
}

function formatTime(sec) {
  const n = Number(sec || 0);
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function normalizeTrack(track) {
  const rawTitle = track.title || "Unknown Title";
  const cleanedTitle = rawTitle
    .replace(/^\s*\d+\s*[-.)]\s*/g, "")
    .replace(/^\s*\[\d+\]\s*/g, "")
    .trim() || "Untitled";
  const rawArtist = track.artist || "";
  const safeArtist = !rawArtist || /^unknown artist$/i.test(rawArtist.trim()) ? "Hound Artist" : rawArtist;
  const rawAlbum = track.album || "";
  const safeAlbum = !rawAlbum || /^local mock library$/i.test(rawAlbum.trim()) ? "Hound Sessions" : rawAlbum;
  return {
    ...track,
    id: track.id,
    title: cleanedTitle,
    artist: safeArtist,
    album: safeAlbum,
    saved: Boolean(track.saved),
    archivedAt: track.archivedAt || null,
    durationSec: Number.isFinite(track.durationSec) ? track.durationSec : null
  };
}

export default function App() {
  const providerRef = useRef(createLibraryProvider());
  const audioRef = useRef(null);

  const [tracks, setTracks] = useState([]);
  const [transport, dispatchTransport] = useReducer(transportReducer, initialTransport);
  const [nav, setNav] = useState("now");
  const [search, setSearch] = useState("");
  const [resolvedSource, setResolvedSource] = useState({ trackId: null, url: "" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState("Loading library...");
  const [toast, setToast] = useState("");
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [pendingPlaySource, setPendingPlaySource] = useState("backend");
  const [autoPlayOnSelect, setAutoPlayOnSelect] = useState(false);

  const selectedId = transport.currentTrackId;
  const currentTrack = tracks.find((t) => t.id === selectedId) || null;
  const canGoPrevious = transport.currentIndex > 0;

  const activeTracks = useMemo(() => tracks.filter((t) => !t.archivedAt), [tracks]);

  const searchLower = search.trim().toLowerCase();
  const searchSongs = useMemo(() => {
    if (!searchLower) return [];
    return tracks.filter((t) =>
      [t.title, t.artist, t.album].some((v) => String(v || "").toLowerCase().includes(searchLower))
    );
  }, [tracks, searchLower]);

  const artists = useMemo(() => {
    const map = new Map();
    tracks.forEach((t) => {
      if (!map.has(t.artist)) map.set(t.artist, []);
      map.get(t.artist).push(t);
    });
    return Array.from(map.entries()).map(([name, songs]) => ({ name, songs }));
  }, [tracks]);

  const albums = useMemo(() => {
    const map = new Map();
    tracks.forEach((t) => {
      const key = `${t.album}__${t.artist}`;
      if (!map.has(key)) map.set(key, { title: t.album, artist: t.artist, songs: [] });
      map.get(key).songs.push(t);
    });
    return Array.from(map.values());
  }, [tracks]);

  const searchArtists = useMemo(() => artists.filter((a) => a.name.toLowerCase().includes(searchLower)), [artists, searchLower]);
  const searchAlbums = useMemo(
    () => albums.filter((a) => a.title.toLowerCase().includes(searchLower) || a.artist.toLowerCase().includes(searchLower)),
    [albums, searchLower]
  );

  useEffect(() => {
    const boot = async () => {
      const list = await providerRef.current.listTracks();
      const normalized = list.map(normalizeTrack).filter((t) => t.id);
      setTracks(normalized);
      const first = normalized.find((t) => !t.archivedAt) || normalized[0] || null;
      if (first?.id) {
        dispatchTransport({ type: "LOAD_INITIAL_TRACK", trackId: first.id });
      }
      setStatus(`Provider: ${PROVIDER_MODE} | Tracks: ${normalized.length}`);
    };
    boot().catch((err) => setStatus(`Library load failed: ${err.message}`));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => handleEnded();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  });

  useEffect(() => {
    const shouldAutoPlay = autoPlayOnSelect;
    setCurrentTime(0);
    setDuration(0);
    if (!shouldAutoPlay) {
      setIsPlaying(false);
      return;
    }
    setAutoPlayOnSelect(false);
    const timer = setTimeout(() => {
      startPlayback().catch((error) => {
        setStatus(`Playback failed: ${error instanceof Error ? error.message : String(error)}`);
        setIsPlaying(false);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const emitLearningSignal = (type, payload = {}) => {
    const trackId = payload.trackId || currentTrack?.id || null;
    const event = {
      type,
      trackId,
      source: payload.source || "backend",
      timestamp: new Date().toISOString(),
      ...payload
    };
    window.Hound?.recordTelemetryEvent?.(event);
    if (import.meta?.env?.DEV) {
      console.log("TRANSPORT_EVENT", event);
    }
  };

  const ensureSource = async (track) => {
    if (!track) return null;
    if (resolvedSource.trackId === track.id && resolvedSource.url) return resolvedSource.url;
    const resolved = await providerRef.current.resolveStreamUrl(track);
    setResolvedSource({ trackId: track.id, url: resolved });
    return resolved;
  };

  const playAudio = async (track) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    setStatus("Loading track...");
    const resolved = await ensureSource(track);
    if (!resolved) return;
    if (audio.dataset.trackId !== track.id || !audio.src) {
      audio.src = resolved;
      audio.dataset.trackId = track.id;
    }
    await audio.play();
    setIsPlaying(true);
    setStatus(`Playing: ${track.title}`);
    emitLearningSignal("play", { trackId: track.id, source: pendingPlaySource });
    setPendingPlaySource("backend");
  };

  const startPlayback = async () => {
    if (!currentTrack && activeTracks.length > 0) {
      dispatchTransport({ type: "LOAD_INITIAL_TRACK", trackId: activeTracks[0].id });
      return;
    }
    if (!currentTrack) return;
    await playAudio(currentTrack);
  };

  const chooseRecommendation = () => {
    const pool = activeTracks.filter((t) => t.id !== currentTrack?.id);
    if (!pool.length) return null;
    const notRecent = pool.filter((t) => !transport.timeline.slice(-8).includes(t.id));
    const candidates = notRecent.length ? notRecent : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  };

  const moveToTimelineTrack = (nextIndex, source) => {
    const nextId = transport.timeline[nextIndex];
    if (!nextId) return;
    setPendingPlaySource(source);
    setAutoPlayOnSelect(true);
    dispatchTransport({ type: "GO_NEXT_EXISTING" });
  };

  const nextManual = () => {
    if (!currentTrack) return;
    // TRANSPORT FREEZE:
    // If forward history exists, Next is pure navigation.
    // Do NOT emit skip, do NOT recommend, do NOT append.
    if (transport.currentIndex < transport.timeline.length - 1) {
      moveToTimelineTrack(transport.currentIndex + 1, "history");
      return;
    }
    // TRANSPORT FREEZE:
    // Next at timeline end is the only place manual skip is emitted
    // and a new recommendation is appended.
    emitLearningSignal("skip", { trackId: currentTrack.id, reason: "next_button" });
    const rec = chooseRecommendation();
    if (!rec) return;
    setPendingPlaySource("backend");
    setAutoPlayOnSelect(true);
    dispatchTransport({ type: "APPEND_RECOMMENDED_TRACK", trackId: rec.id });
  };

  const handleEnded = () => {
    if (!currentTrack) return;
    // TRANSPORT FREEZE:
    // Natural end emits song_finished, never skip.
    emitLearningSignal("song_finished", { trackId: currentTrack.id });
    // If forward history exists, consume it first; no recommendation call.
    if (transport.currentIndex < transport.timeline.length - 1) {
      moveToTimelineTrack(transport.currentIndex + 1, "history");
      return;
    }
    // Only when at end of timeline do we request and append a recommendation.
    const rec = chooseRecommendation();
    if (!rec) {
      setIsPlaying(false);
      return;
    }
    setPendingPlaySource("backend");
    setAutoPlayOnSelect(true);
    dispatchTransport({ type: "APPEND_RECOMMENDED_TRACK", trackId: rec.id });
  };

  const prevTrack = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      if (!isPlaying) setCurrentTime(0);
      emitLearningSignal("previous_restart_current", { trackId: currentTrack.id });
      return;
    }
    // TRANSPORT FREEZE:
    // Previous is history-only. It never recommends or appends.
    if (!canGoPrevious) return;
    setPendingPlaySource("history");
    setAutoPlayOnSelect(true);
    dispatchTransport({ type: "GO_PREVIOUS" });
    emitLearningSignal("previous_track", { trackId: currentTrack.id });
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      emitLearningSignal("pause", { trackId: currentTrack?.id, position: Number((audio.currentTime || 0).toFixed(2)) });
      return;
    }
    try {
      await startPlayback();
    } catch (error) {
      setStatus(`Playback failed: ${error instanceof Error ? error.message : String(error)}`);
      setIsPlaying(false);
    }
  };

  const seekTo = (event) => {
    const audio = audioRef.current;
    const effectiveDuration = duration > 0 ? duration : Number(currentTrack?.durationSec || 0);
    if (!audio || !effectiveDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextTime = ratio * effectiveDuration;
    const fromTime = audio.currentTime || 0;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    emitLearningSignal("seek", { trackId: currentTrack?.id, from_position: Number(fromTime.toFixed(2)), to_position: Number(nextTime.toFixed(2)) });
  };

  const startNewTimelineWithSelectedTrack = (trackId, source) => {
    if (!trackId || trackId === selectedId) return;
    setPendingPlaySource(source);
    setAutoPlayOnSelect(true);
    dispatchTransport({ type: "START_NEW_TIMELINE_WITH_SELECTED_TRACK", trackId });
    setNav("now");
  };

  const toggleFavorite = (trackId = selectedId) => {
    if (!trackId) return;
    const existing = tracks.find((t) => t.id === trackId);
    const nextSaved = !existing?.saved;
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, saved: nextSaved } : t)));
    emitLearningSignal(nextSaved ? "favorite" : "unfavorite", { trackId });
  };

  const restoreArchived = (trackId) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, archivedAt: null } : t)));
    setToast("Restored to rotation");
    emitLearningSignal("restore", { trackId });
  };

  const renderSongRows = (list, source = "library") => (
    <ul className="song-list">
      {list.map((track) => (
        <li key={track.id} className={`song-row ${track.id === selectedId ? "active" : ""}`}>
          <button
            className="song-main"
            type="button"
            onClick={() => {
              if (source === "search") {
                emitLearningSignal("search_play", { trackId: track.id });
              } else {
                emitLearningSignal("selected_play", { trackId: track.id, source });
              }
              startNewTimelineWithSelectedTrack(track.id, source);
            }}
          >
            <span className="song-art">{track.title.slice(0, 2).toUpperCase()}</span>
            <span className="song-text">
              <strong>{track.title}</strong>
              <small>
                {track.artist} {" • "} {track.album}
              </small>
            </span>
          </button>
          <span className="row-duration">{track.durationSec ? formatTime(track.durationSec) : "--:--"}</span>
          <button className="icon-btn" onClick={() => toggleFavorite(track.id)} title="Favorite">{track.saved ? ICON.starOn : ICON.starOff}</button>
        </li>
      ))}
    </ul>
  );

  const effectiveDuration = duration > 0 ? duration : Number(currentTrack?.durationSec || 0);

  const renderMain = () => {
    if (nav === "now") {
      return (
        <section className="panel now-panel">
          <div className="now-art">{(currentTrack?.title || "HD").slice(0, 2).toUpperCase()}</div>
          <div className="now-meta">
            <h2>{currentTrack?.title || "No song selected"}</h2>
            <p>{currentTrack?.artist || ""}</p>
            <p>{currentTrack?.album || ""}</p>
          </div>
          <div className="progress-wrap">
            <div className="progress" onClick={seekTo} role="button" tabIndex={0}>
              <div className="progress-fill" style={{ width: `${effectiveDuration ? (currentTime / effectiveDuration) * 100 : 0}%` }} />
            </div>
            <div className="time-row">
              <span>{formatTime(currentTime)}</span>
              <span>{effectiveDuration ? formatTime(effectiveDuration) : "--:--"}</span>
            </div>
          </div>
          <div className="transport">
            <button className="transport-btn" onClick={prevTrack} disabled={!canGoPrevious}>{ICON.prev}</button>
            <button className="transport-btn main" onClick={togglePlay}>{isPlaying ? ICON.pause : ICON.play}</button>
            <button className="transport-btn" onClick={nextManual}>{ICON.next}</button>
          </div>
          <div className="manage-row">
            <button className="pill-btn" onClick={() => toggleFavorite()}>{currentTrack?.saved ? `${ICON.starOn} Favorited` : `${ICON.starOff} Favorite`}</button>
          </div>
          <div className="volume-row">
            <button className="icon-btn" onClick={() => setMuted((m) => !m)} title={muted ? "Unmute" : "Mute"}>{muted ? ICON.mute : ICON.volume}</button>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="volume-slider" />
          </div>
        </section>
      );
    }

    if (nav === "search") {
      return (
        <section className="panel">
          <h2>Search Results</h2>
          <h3>Songs</h3>
          {renderSongRows(searchSongs.slice(0, 30), "search")}
          <h3>Artists</h3>
          <div className="chip-grid">
            {searchArtists.slice(0, 20).map((a) => (
              <button key={a.name} className="chip">{a.name}</button>
            ))}
          </div>
          <h3>Albums</h3>
          <div className="chip-grid">
            {searchAlbums.slice(0, 20).map((a) => (
              <button key={`${a.title}-${a.artist}`} className="chip">{a.title} <small>{a.artist}</small></button>
            ))}
          </div>
        </section>
      );
    }

    if (nav === "favorites") {
      return <section className="panel"><h2>Favorites</h2>{renderSongRows(tracks.filter((t) => t.saved), "favorites")}</section>;
    }

    if (nav === "archive") {
      const archived = tracks.filter((t) => t.archivedAt);
      return (
        <section className="panel">
          <h2>Archive</h2>
          <p className="muted">Songs out of rotation</p>
          <ul className="song-list">
            {archived.map((t) => (
              <li key={t.id} className="song-row">
                <div className="song-main static">
                  <span className="song-art">{t.title.slice(0, 2).toUpperCase()}</span>
                  <span className="song-text"><strong>{t.title}</strong><small>{t.artist} • {t.album}</small></span>
                </div>
                <button className="pill-btn" onClick={() => restoreArchived(t.id)}>Restore</button>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    return (
      <section className="panel">
        <h2>Settings</h2>
        <p className="muted">{status}</p>
      </section>
    );
  };

  return (
    <div className="hound-root">
      <audio ref={audioRef} preload="metadata" />
      <header className="top-bar">
        <input
          className="search"
          value={search}
          onFocus={() => setNav("search")}
          onClick={() => setNav("search")}
          onChange={(e) => {
            if (nav !== "search") setNav("search");
            setSearch(e.target.value);
            if (e.target.value.trim()) emitLearningSignal("search", { query: e.target.value.trim() });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const topSong = searchSongs[0];
              if (topSong) {
                emitLearningSignal("search_play", { trackId: topSong.id });
                startNewTimelineWithSelectedTrack(topSong.id, "search");
              }
            }
          }}
          placeholder="Search songs, artists, albums"
        />
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h1>Hound</h1>
          {NAV.map((item) => (
            <button key={item.key} className={`nav-btn ${nav === item.key ? "active" : ""}`} onClick={() => setNav(item.key)}>{item.label}</button>
          ))}
        </aside>
        <main className="content">{renderMain()}</main>
      </div>

      {nav !== "now" ? (
        <aside className="mini-player">
          <button className="mini-info" onClick={() => setNav("now")}>
            <span className="mini-art">{(currentTrack?.title || "HD").slice(0, 2).toUpperCase()}</span>
            <span className="mini-text">
              <strong>{currentTrack?.title || "No song selected"}</strong>
              <small>{currentTrack?.artist || "Hound Artist"}</small>
            </span>
          </button>
          <div className="mini-controls">
            <button className="icon-btn" onClick={prevTrack} disabled={!canGoPrevious}>{ICON.prev}</button>
            <button className="icon-btn main" onClick={togglePlay}>{isPlaying ? ICON.pause : ICON.play}</button>
            <button className="icon-btn" onClick={nextManual}>{ICON.next}</button>
          </div>
        </aside>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
