import React, { useEffect, useMemo, useRef, useState } from "react";

// Track shape contract:
// Track { id: string, path: string, title: string, artist: string, liked: boolean }

// SessionEndPayload contract:
// { listenedSeconds: number, tracksPlayed: number, skips: number }

const styles = {
  app: {
    minHeight: "100vh",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "12px"
  },
  brand: {
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "2px"
  },
  nav: {
    display: "flex",
    gap: "10px"
  },
  navButton: {
    border: "1px solid #334155",
    borderRadius: "8px",
    background: "transparent",
    color: "#e5e7eb",
    padding: "8px 14px",
    fontWeight: 600
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  library: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  libraryButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap"
  },
  primaryButton: {
    border: "none",
    background: "#38bdf8",
    color: "#0a0f1a",
    padding: "10px 14px",
    borderRadius: "8px",
    fontWeight: 700
  },
  secondaryButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "10px 14px",
    borderRadius: "8px",
    fontWeight: 600
  },
  listTitle: {
    fontSize: "14px",
    fontWeight: 700,
    margin: "6px 0"
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  row: (active) => ({
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #1f2937",
    background: active ? "#12243a" : "#0f172a",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  }),
  rowTitle: {
    fontWeight: 700,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  rowArtist: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  rowActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center"
  },
  queueButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600
  },
  empty: {
    color: "#9ca3af",
    fontSize: "13px"
  },
  playerWrap: {
    display: "flex",
    justifyContent: "center"
  },
  playerCard: {
    width: "100%",
    maxWidth: "420px",
    background: "#121827",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  cover: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #1f2937, #0f172a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    color: "#94a3b8",
    userSelect: "none"
  },
  trackTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0
  },
  trackArtist: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: "6px 0 0 0"
  },
  controls: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap"
  },
  controlButton: {
    border: "none",
    background: "#1e293b",
    color: "#e5e7eb",
    padding: "8px 12px",
    borderRadius: "8px",
    fontWeight: 600,
    minWidth: "70px"
  },
  playButton: {
    background: "#38bdf8",
    color: "#0a0f1a"
  },
  likeActive: {
    background: "#dc2626",
    color: "#fff"
  },
  flipButton: {
    alignSelf: "center",
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "6px 14px",
    borderRadius: "999px",
    fontWeight: 600
  },
  backSectionTitle: {
    fontSize: "15px",
    fontWeight: 700,
    margin: 0
  },
  backBox: {
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "10px",
    background: "#0f172a",
    color: "#9ca3af",
    maxHeight: "120px",
    overflowY: "auto",
    fontSize: "12px",
    lineHeight: 1.5
  },
  errorBanner: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #7f1d1d",
    background: "#1f0b0b",
    color: "#fecaca",
    fontSize: "12px"
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20
  },
  modal: {
    background: "#121827",
    borderRadius: "12px",
    padding: "18px",
    border: "1px solid #1f2937",
    width: "min(420px, 90vw)",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "10px"
  }
};

const getFileName = (filePath) => {
  if (typeof filePath !== "string") return "Unknown file";
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
};

const parseTrackMeta = (filePath) => {
  const title = getFileName(filePath).replace(/\.[^/.\\]+$/, "") || "Unknown Title";
  return { title, artist: "Unknown Artist" };
};

const useSessionStats = () => {
  const statsRef = useRef({ listenedSeconds: 0, tracksPlayed: 0, skips: 0 });
  const lastTimeRef = useRef(0);
  const sessionActiveRef = useRef(false);

  const startSessionIfNeeded = () => {
    if (!sessionActiveRef.current) {
      statsRef.current = { listenedSeconds: 0, tracksPlayed: 0, skips: 0 };
      lastTimeRef.current = 0;
      sessionActiveRef.current = true;
    }
  };

  const markTrackPlayed = () => {
    statsRef.current.tracksPlayed += 1;
  };

  const markSkip = () => {
    statsRef.current.skips += 1;
  };

  const addListenedDelta = (delta) => {
    if (delta > 0) {
      statsRef.current.listenedSeconds += delta;
    }
  };

  const endSession = () => {
    sessionActiveRef.current = false;
    return {
      listenedSeconds: Number(statsRef.current.listenedSeconds.toFixed(1)),
      tracksPlayed: statsRef.current.tracksPlayed,
      skips: statsRef.current.skips
    };
  };

  return {
    statsRef,
    lastTimeRef,
    sessionActiveRef,
    startSessionIfNeeded,
    markTrackPlayed,
    markSkip,
    addListenedDelta,
    endSession
  };
};

export default function App() {
  const [screen, setScreen] = useState("library");
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const activeAudioRef = useRef("A");
  const isCrossfadingRef = useRef(false);
  const lastPlayedTrackIdRef = useRef(null);
  const shuffleHistoryRef = useRef([]);
  const queueRef = useRef([]);
  const session = useSessionStats();
  const CROSSFADE_SECONDS = 1;

  const selectedIndex = useMemo(
    () => tracks.findIndex((track) => track.id === selectedTrackId),
    [tracks, selectedTrackId]
  );
  const selectedTrack = selectedIndex >= 0 ? tracks[selectedIndex] : null;

  function getActiveAudio() {
    return activeAudioRef.current === "A" ? audioARef.current : audioBRef.current;
  }

  function getInactiveAudio() {
    return activeAudioRef.current === "A" ? audioBRef.current : audioARef.current;
  }

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const stopAllAudio = () => {
    [audioARef.current, audioBRef.current].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    });
  };

  const fadeAudio = (audio, from, to, durationMs, onDone) => {
    if (!audio) {
      if (onDone) onDone();
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      audio.volume = from + (to - from) * progress;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else if (onDone) {
        onDone();
      }
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onError = () => {
      setError("Could not play this file.");
      setIsPlaying(false);
    };
    const onLoadedMetadata = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onTimeUpdate = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      if (!session.sessionActiveRef.current || !isPlaying) return;
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const delta = currentTime - session.lastTimeRef.current;
      session.addListenedDelta(delta);
      session.lastTimeRef.current = currentTime;
      if (!isSeeking) {
        setCurrentTime(currentTime);
      }
      const remaining = Number.isFinite(audio.duration) ? audio.duration - currentTime : 0;
      if (
        !isCrossfadingRef.current &&
        isPlaying &&
        remaining > 0 &&
        remaining <= CROSSFADE_SECONDS
      ) {
        const queuedId = queueRef.current[0];
        if (queuedId) {
          const queuedIndex = tracks.findIndex((track) => track.id === queuedId);
          if (queuedIndex >= 0) {
            popQueueTrackId();
            startCrossfade(queuedIndex);
            return;
          }
          popQueueTrackId();
        }
        if (selectedIndex >= 0 && selectedIndex < tracks.length - 1) {
          startCrossfade(selectedIndex + 1);
        }
      }
    };
    const onEnded = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      const queuedId = queueRef.current[0];
      if (queuedId) {
        const queuedIndex = tracks.findIndex((track) => track.id === queuedId);
        if (queuedIndex >= 0) {
          popQueueTrackId();
          startCrossfade(queuedIndex);
          return;
        }
        popQueueTrackId();
      }
      if (selectedIndex >= 0 && selectedIndex < tracks.length - 1) {
        startCrossfade(selectedIndex + 1);
        return;
      }
      setIsPlaying(false);
    };
    const audios = [audioARef.current, audioBRef.current].filter(Boolean);
    audios.forEach((audio) => {
      audio.addEventListener("error", onError);
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);
    });
    return () => {
      audios.forEach((audio) => {
        audio.removeEventListener("error", onError);
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
      });
    };
  }, [isPlaying, session, isSeeking, selectedIndex, tracks.length]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName ?? "";
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayPause();
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        handleNext();
        return;
      }
      if (event.code === "KeyS") {
        event.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });


  const loadAndPlay = (track) => {
    if (!track) return;
    const audio = getActiveAudio();
    if (!audio) return;
    const normalized = track.path.replace(/\\/g, "/");
    const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const src = `file://${encodeURI(prefixed)}`;
    stopAllAudio();
    audio.volume = 1;
    audio.src = src;
    audio.load();
    setCurrentTime(0);
    setError("");
    session.startSessionIfNeeded();
    session.markTrackPlayed();
    lastPlayedTrackIdRef.current = track.id;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const startCrossfade = (nextIndex) => {
    if (isCrossfadingRef.current) return;
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    const currentAudio = getActiveAudio();
    const nextAudio = getInactiveAudio();
    if (!currentAudio || !nextAudio) return;
    const nextTrack = tracks[nextIndex];
    const normalized = nextTrack.path.replace(/\\/g, "/");
    const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const src = `file://${encodeURI(prefixed)}`;
    isCrossfadingRef.current = true;
    nextAudio.pause();
    nextAudio.currentTime = 0;
    nextAudio.volume = 0;
    nextAudio.src = src;
    nextAudio.load();
    session.startSessionIfNeeded();
    session.markTrackPlayed();
    nextAudio
      .play()
      .then(() => {
        fadeAudio(nextAudio, 0, 1, CROSSFADE_SECONDS * 1000);
        fadeAudio(currentAudio, currentAudio.volume, 0, CROSSFADE_SECONDS * 1000, () => {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          activeAudioRef.current = activeAudioRef.current === "A" ? "B" : "A";
          setSelectedTrackId(nextTrack.id);
          setIsPlaying(true);
          setShowBack(false);
          setDuration(Number.isFinite(nextAudio.duration) ? nextAudio.duration : 0);
          setCurrentTime(0);
          isCrossfadingRef.current = false;
        });
      })
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
        isCrossfadingRef.current = false;
      });
  };

  const popQueueTrackId = () => {
    const currentQueue = queueRef.current;
    if (!Array.isArray(currentQueue) || currentQueue.length === 0) return null;
    let nextId = null;
    const remaining = [...currentQueue];
    while (remaining.length > 0) {
      const candidate = remaining.shift();
      const exists = tracks.some((track) => track.id === candidate);
      if (exists) {
        nextId = candidate;
        break;
      }
    }
    queueRef.current = remaining;
    setQueue(remaining);
    return nextId;
  };

  const togglePlayPause = () => {
    const audio = getActiveAudio();
    if (!selectedTrack || !audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    session.startSessionIfNeeded();
    if (lastPlayedTrackIdRef.current !== selectedTrack.id) {
      session.markTrackPlayed();
      lastPlayedTrackIdRef.current = selectedTrack.id;
      audio.currentTime = 0;
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const goToTrack = (index) => {
    if (index < 0 || index >= tracks.length) return;
    setSelectedTrackId(tracks[index].id);
    setScreen("player");
    loadAndPlay(tracks[index]);
  };

  const handlePrev = () => {
    if (!selectedTrack || !getActiveAudio()) return;
    if (shuffleOn && shuffleHistoryRef.current.length > 0) {
      const lastIndex = shuffleHistoryRef.current.pop();
      if (typeof lastIndex === "number") {
        goToTrack(lastIndex);
        return;
      }
    }
    if (selectedIndex > 0) {
      goToTrack(selectedIndex - 1);
      return;
    }
    const audio = getActiveAudio();
    audio.currentTime = 0;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const handleNext = () => {
    if (!selectedTrack || !getActiveAudio()) return;
    const audio = getActiveAudio();
    if (audio.currentTime < 30) {
      session.markSkip();
    }
    const queuedId = popQueueTrackId();
    if (queuedId) {
      const queuedIndex = tracks.findIndex((track) => track.id === queuedId);
      if (queuedIndex >= 0) {
        goToTrack(queuedIndex);
        return;
      }
    }
    if (shuffleOn && tracks.length > 1) {
      shuffleHistoryRef.current.push(selectedIndex);
      let nextIndex = selectedIndex;
      while (nextIndex === selectedIndex) {
        nextIndex = Math.floor(Math.random() * tracks.length);
      }
      goToTrack(nextIndex);
      return;
    }
    if (selectedIndex < tracks.length - 1) {
      goToTrack(selectedIndex + 1);
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const handleStop = () => {
    stopAllAudio();
    setCurrentTime(0);
    setIsPlaying(false);
    const payload = session.endSession();
    setRecap(payload);
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const openAudioFiles = window?.hound?.openAudioFiles;
      if (typeof openAudioFiles !== "function") {
        console.warn("[Hound] window.hound.openAudioFiles is unavailable.");
        return;
      }
      const result = await openAudioFiles();
      if (!Array.isArray(result) || result.length === 0) return;
      setTracks((prev) => {
        const existing = new Set(prev.map((track) => track.path));
        const additions = result
          .filter((path) => typeof path === "string" && path.trim().length > 0)
          .filter((path) => !existing.has(path))
          .map((path) => {
            const { title, artist } = parseTrackMeta(path);
            return {
              id: path,
              path,
              title,
              artist,
              liked: false
            };
          });
        const next = [...prev, ...additions];
        if (selectedTrackId === null && additions.length > 0) {
          setSelectedTrackId(additions[0].id);
        }
        return next;
      });
    } finally {
      setImporting(false);
    }
  };

  const clearLibrary = () => {
    setTracks([]);
    setSelectedTrackId(null);
    setScreen("library");
    setIsPlaying(false);
    setQueue([]);
    stopAllAudio();
    setCurrentTime(0);
    setDuration(0);
  };

  const handleRowClick = (trackId) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return;
    shuffleHistoryRef.current = [];
    goToTrack(index);
  };

  const queueTrackNext = (trackId) => {
    if (!trackId) return;
    setQueue((prev) => [...prev, trackId]);
  };

  const toggleLike = () => {
    if (!selectedTrack) return;
    setTracks((prev) =>
      prev.map((track) =>
        track.id === selectedTrack.id ? { ...track, liked: !track.liked } : track
      )
    );
  };

  const formatTime = (value) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const handleScrubStart = () => {
    setIsSeeking(true);
  };

  const handleScrubChange = (event) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) return;
    setCurrentTime(nextValue);
  };

  const handleScrubEnd = () => {
    const audio = getActiveAudio();
    if (!audio) {
      setIsSeeking(false);
      return;
    }
    audio.currentTime = currentTime;
    setIsSeeking(false);
  };

  const toggleShuffle = () => {
    setShuffleOn((prev) => !prev);
    shuffleHistoryRef.current = [];
  };

  const activeScreen = screen === "player" ? "player" : "library";

  return (
    <div style={styles.app}>
      <header style={styles.topBar}>
        <div style={styles.brand}>HOUND</div>
        <div style={styles.nav}>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("library")}
          >
            Library
          </button>
          <button
            type="button"
            style={styles.navButton}
            disabled={tracks.length === 0}
            onClick={() => {
              if (tracks.length > 0) setScreen("player");
            }}
          >
            Player
          </button>
        </div>
      </header>

      <main style={styles.content}>
        {activeScreen === "library" ? (
          <section style={styles.library}>
            <div style={styles.libraryButtons}>
              <button type="button" style={styles.primaryButton} onClick={handleImport}>
                Import
              </button>
              <button type="button" style={styles.secondaryButton} onClick={clearLibrary}>
                Clear Library
              </button>
            </div>
            <div>
              <div style={styles.listTitle}>Imported Tracks</div>
              <ul style={styles.list}>
                {tracks.map((track) => (
                  <li
                    key={track.id}
                    style={styles.row(track.id === selectedTrackId)}
                    onClick={() => handleRowClick(track.id)}
                  >
                    <div style={styles.rowTitle}>
                      <span>{track.title}</span>
                      <div style={styles.rowActions}>
                        {track.liked ? <span aria-label="liked">&lt;3</span> : null}
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            queueTrackNext(track.id);
                          }}
                        >
                          Queue Next
                        </button>
                      </div>
                    </div>
                    <div style={styles.rowArtist}>{track.artist}</div>
                  </li>
                ))}
                {tracks.length === 0 ? (
                  <li style={styles.empty}>No tracks yet. Click Import.</li>
                ) : null}
              </ul>
            </div>
          </section>
        ) : (
          <section style={styles.playerWrap}>
            <div style={styles.playerCard}>
              {selectedTrack ? (
                <>
                  {showBack ? (
                    <>
                      <h2 style={styles.backSectionTitle}>Credits</h2>
                      <div style={styles.backBox}>
                        Writer: Placeholder
                        <br />
                        Producer: Placeholder
                        <br />
                        Engineer: Placeholder
                        <br />
                        Recorded at: Placeholder Studio
                      </div>
                      <h2 style={styles.backSectionTitle}>Lyrics</h2>
                      <div style={styles.backBox}>
                        Placeholder lyrics text goes here. Line one.
                        <br />
                        Line two.
                        <br />
                        Line three.
                      </div>
                      <button
                        type="button"
                        style={styles.flipButton}
                        onClick={() => setShowBack(false)}
                      >
                        ⟲
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={styles.cover}
                        onDoubleClick={() => setShowBack(true)}
                      >
                        Cover Art
                      </div>
                      <div>
                        <h2 style={styles.trackTitle}>{selectedTrack.title}</h2>
                        <p style={styles.trackArtist}>{selectedTrack.artist}</p>
                      </div>
                      {error ? <div style={styles.errorBanner}>{error}</div> : null}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input
                          type="range"
                          min={0}
                          max={duration || 0}
                          step="0.1"
                          value={currentTime}
                          onMouseDown={handleScrubStart}
                          onTouchStart={handleScrubStart}
                          onChange={handleScrubChange}
                          onMouseUp={handleScrubEnd}
                          onTouchEnd={handleScrubEnd}
                          disabled={!selectedTrack}
                          aria-label="Seek"
                        />
                        <div
                          style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ca3af" }}
                        >
                          <span onClick={() => setShowRemaining((prev) => !prev)} style={{ cursor: "pointer" }}>
                            {showRemaining
                              ? `-${formatTime(Math.max(duration - currentTime, 0))}`
                              : formatTime(currentTime)}
                          </span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>
                      <div style={styles.controls}>
                        <button
                          type="button"
                          style={styles.controlButton}
                          onClick={handlePrev}
                          aria-label="Previous"
                        >
                          ⏮
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.controlButton, ...styles.playButton }}
                          onClick={togglePlayPause}
                          aria-label="Play/Pause"
                        >
                          {isPlaying ? "⏸" : "▶"}
                        </button>
                        <button
                          type="button"
                          style={styles.controlButton}
                          onClick={handleNext}
                          aria-label="Next"
                        >
                          ⏭
                        </button>
                        <button
                          type="button"
                          style={styles.controlButton}
                          onClick={handleStop}
                          aria-label="Stop"
                        >
                          ⏹
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.controlButton,
                            ...(selectedTrack.liked ? styles.likeActive : {})
                          }}
                          onClick={toggleLike}
                          aria-label="Like"
                        >
                          {selectedTrack.liked ? "♥" : "♡"}
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.controlButton,
                            ...(shuffleOn ? styles.playButton : {})
                          }}
                          onClick={toggleShuffle}
                          aria-label="Shuffle"
                        >
                          ⤮
                        </button>
                      </div>
                      {queue.length > 0 ? (
                        <div style={styles.rowArtist}>
                          Up Next (queue): {queue.length}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        style={styles.flipButton}
                        onClick={() => setShowBack(true)}
                      >
                        ⟳
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div style={styles.empty}>Select a track from Library.</div>
              )}
            </div>
          </section>
        )}
      </main>

      {recap ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div>Thanks for listening.</div>
            <div>Time listened: {recap.listenedSeconds}s</div>
            <div>Tracks played: {recap.tracksPlayed}</div>
            <div>Skips: {recap.skips}</div>
            <div style={styles.modalButtons}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setRecap(null)}
              >
                Close
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => {
                  setRecap(null);
                  setScreen("library");
                }}
              >
                Go to Library
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <audio ref={audioARef} />
      <audio ref={audioBRef} />
    </div>
  );
}
