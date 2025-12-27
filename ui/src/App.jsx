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
  homePage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  homeCard: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "14px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  homeCardTitle: {
    fontSize: "13px",
    fontWeight: 700
  },
  homeActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  playlistPage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  queuePage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  searchPage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  settingsPage: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  settingsSection: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "14px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  settingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "13px"
  },
  input: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "10px 12px",
    borderRadius: "8px"
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
  queuePanel: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "12px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  queueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "13px",
    fontWeight: 700
  },
  queueNowPlaying: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #1f2937",
    background: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  queueNowLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  queueNowTitle: {
    fontSize: "14px",
    fontWeight: 700
  },
  queueNowArtist: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  queueList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  queueRow: {
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px"
  },
  queueMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px"
  },
  queueTitle: {
    fontSize: "13px",
    fontWeight: 600
  },
  queueArtist: {
    fontSize: "11px",
    color: "#9ca3af"
  },
  queueActions: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  queueDrag: {
    border: "1px dashed #334155",
    background: "transparent",
    color: "#9ca3af",
    padding: "4px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "grab"
  },
  queueActionButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "4px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600
  },
  empty: {
    color: "#9ca3af",
    fontSize: "13px"
  },
  badge: {
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "2px 6px",
    fontSize: "10px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
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
  },
  nowPlayingBar: {
    position: "fixed",
    left: "24px",
    right: "24px",
    bottom: "18px",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    zIndex: 10,
    cursor: "pointer"
  },
  nowPlayingInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0
  },
  nowPlayingTitle: {
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  nowPlayingArtist: {
    fontSize: "11px",
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  nowPlayingControls: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  nowPlayingButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "6px 10px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600
  },
  nowPlayingProgressWrap: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "6px",
    height: "4px",
    background: "#1f2937",
    borderRadius: "999px",
    overflow: "hidden"
  },
  nowPlayingProgress: {
    height: "100%",
    background: "#38bdf8",
    width: "0%"
  },
  nowPlayingTime: {
    position: "absolute",
    right: "14px",
    bottom: "12px",
    fontSize: "11px",
    color: "#9ca3af",
    background: "rgba(15, 23, 42, 0.8)",
    padding: "2px 6px",
    borderRadius: "999px"
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

const getAlbumName = () => "Unknown Album";

const MarqueeText = ({ text, maxChars = 28 }) => {
  const isLong = typeof text === "string" && text.length > maxChars;
  const className = isLong ? "marquee" : "marquee-static";
  return (
    <div className={className} aria-label={text}>
      {isLong ? (
        <div className="marquee-inner">
          <span>{text}</span>
          <span className="marquee-gap">{text}</span>
        </div>
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
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
  const [screen, setScreen] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [activeArtist, setActiveArtist] = useState(null);
  const [albumPlaylistId, setAlbumPlaylistId] = useState("");
  const [artistPlaylistId, setArtistPlaylistId] = useState("");
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lastSession, setLastSession] = useState(null);
  const [sessionMode, setSessionMode] = useState("Normal");
  const [settings, setSettings] = useState({
    loudnessEnabled: true,
    crossfadeEnabled: true,
    gapSeconds: 1,
    resumeOnLaunch: true,
    stopEndsSession: true
  });
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
  const shuffleOrderRef = useRef([]);
  const queueRef = useRef([]);
  const pendingNextRef = useRef(null);
  const loudnessPendingRef = useRef(false);
  const loudnessQueueRef = useRef([]);
  const session = useSessionStats();
  const CROSSFADE_SECONDS = 1;
  // Audio contract: one output path, deterministic gain chain, and explicit session boundaries.

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

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("hound.settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && typeof parsed === "object") {
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedHistory = localStorage.getItem("hound.sessionHistory");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setSessionHistory(parsedHistory);
        }
      }
      const savedLast = localStorage.getItem("hound.lastSession");
      if (savedLast) {
        const parsedLast = JSON.parse(savedLast);
        if (parsedLast && typeof parsedLast === "object") {
          setLastSession(parsedLast);
          if (parsedLast.mode) {
            setSessionMode(parsedLast.mode);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("hound.settings", JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem("hound.sessionHistory", JSON.stringify(sessionHistory));
    } catch {
      // ignore storage errors
    }
  }, [sessionHistory]);

  useEffect(() => {
    if (!lastSession) return;
    try {
      localStorage.setItem("hound.lastSession", JSON.stringify(lastSession));
    } catch {
      // ignore storage errors
    }
  }, [lastSession]);

  useEffect(() => {
    if (!settings.loudnessEnabled) {
      loudnessQueueRef.current = [];
      return;
    }
    loudnessQueueRef.current = tracks
      .filter((track) => !track.loudnessReady)
      .map((track) => track.id);
  }, [tracks, settings.loudnessEnabled]);

  useEffect(() => {
    if (loudnessPendingRef.current) return;
    if (!settings.loudnessEnabled) return;
    const nextId = loudnessQueueRef.current[0];
    if (!nextId) return;
    const track = tracks.find((item) => item.id === nextId);
    const analyze = window?.hound?.analyzeLoudness;
    if (!track || typeof analyze !== "function") return;
    loudnessPendingRef.current = true;
    analyze(track.path)
      .then((result) => {
        if (!result || typeof result.gainDb !== "number") {
          return { gainDb: 0 };
        }
        return result;
      })
      .then((result) => {
        const gainLinear = Math.pow(10, result.gainDb / 20);
        setTracks((prev) =>
          prev.map((item) =>
            item.id === track.id
              ? { ...item, gain: gainLinear, loudnessReady: true }
              : item
          )
        );
      })
      .finally(() => {
        loudnessPendingRef.current = false;
        loudnessQueueRef.current = loudnessQueueRef.current.filter((id) => id !== nextId);
      });
  }, [tracks, settings.loudnessEnabled]);

  useEffect(() => {
    if (!settings.loudnessEnabled) {
      setTracks((prev) =>
        prev.map((track) => ({ ...track, gain: 1, loudnessReady: true }))
      );
    }
  }, [settings.loudnessEnabled]);

  useEffect(() => {
    if (!settings.resumeOnLaunch) return;
    if (!lastSession || !lastSession.lastTrackId) return;
    if (selectedTrackId) return;
    const exists = tracks.some((track) => track.id === lastSession.lastTrackId);
    if (exists) {
      setSelectedTrackId(lastSession.lastTrackId);
    }
  }, [lastSession, settings.resumeOnLaunch, tracks, selectedTrackId]);

  const stopAllAudio = () => {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
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
    };
    const onEnded = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      const queuedId = queueRef.current[0];
      let nextIndex = -1;
      if (queuedId) {
        const queuedIndex = tracks.findIndex((track) => track.id === queuedId);
        if (queuedIndex >= 0) {
          popQueueTrackId();
          nextIndex = queuedIndex;
        } else {
          popQueueTrackId();
        }
      }
      if (nextIndex === -1 && selectedIndex >= 0 && selectedIndex < tracks.length - 1) {
        nextIndex = selectedIndex + 1;
      }
      if (nextIndex >= 0) {
        if (pendingNextRef.current) {
          clearTimeout(pendingNextRef.current);
        }
        pendingNextRef.current = setTimeout(() => {
          if (settings.crossfadeEnabled) {
            startCrossfade(nextIndex);
          } else {
            goToTrack(nextIndex);
          }
          pendingNextRef.current = null;
        }, Math.max(1, settings.gapSeconds) * 1000);
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
  }, [
    isPlaying,
    session,
    isSeeking,
    selectedIndex,
    tracks.length,
    settings.crossfadeEnabled,
    settings.gapSeconds
  ]);

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
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    const audio = getActiveAudio();
    if (!audio) return;
    const normalized = track.path.replace(/\\/g, "/");
    const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const src = `houndfile://${encodeURI(prefixed)}`;
    stopAllAudio();
    // Signal chain: per-track LUFS gain -> session envelope (crossfade) -> app volume (unity).
    const baseVolume = settings.loudnessEnabled && Number.isFinite(track.gain) ? track.gain : 1;
    audio.volume = baseVolume;
    audio.src = src;
    audio.load();
    setCurrentTime(0);
    setError("");
    session.startSessionIfNeeded();
    session.markTrackPlayed();
    lastPlayedTrackIdRef.current = track.id;
    setLastSession((prev) => ({
      ...prev,
      lastTrackId: track.id,
      queue: queueRef.current,
      mode: sessionMode
    }));
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
    const nextGain =
      settings.loudnessEnabled && Number.isFinite(nextTrack.gain) ? nextTrack.gain : 1;
    const normalized = nextTrack.path.replace(/\\/g, "/");
    const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const src = `houndfile://${encodeURI(prefixed)}`;
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
        // Crossfade envelope must not exceed unity gain.
        fadeAudio(nextAudio, 0, nextGain, CROSSFADE_SECONDS * 1000);
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
    audio.volume =
      settings.loudnessEnabled && Number.isFinite(selectedTrack.gain)
        ? selectedTrack.gain
        : audio.volume;
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
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    if (shuffleOn) {
      if (shuffleOrderRef.current.length === 0) {
        shuffleOrderRef.current = [selectedTrack.id];
      }
      const currentIndex = shuffleOrderRef.current.indexOf(selectedTrack.id);
      if (currentIndex > 0) {
        const prevId = shuffleOrderRef.current[currentIndex - 1];
        const prevIndex = tracks.findIndex((track) => track.id === prevId);
        if (prevIndex >= 0) {
          goToTrack(prevIndex);
          return;
        }
      }
      if (shuffleOrderRef.current.length > 1) {
        const lastId = shuffleOrderRef.current[shuffleOrderRef.current.length - 1];
        const lastIndex = tracks.findIndex((track) => track.id === lastId);
        if (lastIndex >= 0) {
          goToTrack(lastIndex);
          return;
        }
      }
    } else if (selectedIndex > 0) {
      goToTrack(selectedIndex - 1);
      return;
    } else if (tracks.length > 0) {
      goToTrack(tracks.length - 1);
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
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
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
      let nextIndex = selectedIndex;
      while (nextIndex === selectedIndex) {
        nextIndex = Math.floor(Math.random() * tracks.length);
      }
      const nextId = tracks[nextIndex]?.id;
      if (nextId) {
        if (shuffleOrderRef.current.length === 0) {
          shuffleOrderRef.current = [selectedTrack.id];
        }
        shuffleOrderRef.current.push(nextId);
      }
      goToTrack(nextIndex);
      return;
    }
    if (selectedIndex < tracks.length - 1) {
      goToTrack(selectedIndex + 1);
      return;
    }
    if (tracks.length > 0) {
      goToTrack(0);
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    stopAllAudio();
    setCurrentTime(0);
    setIsPlaying(false);
    if (settings.stopEndsSession) {
      const payload = session.endSession();
      setRecap(payload);
      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
        mode: sessionMode,
        payload
      };
      setSessionHistory((prev) => [historyEntry, ...prev]);
      setLastSession((prev) => ({
        ...prev,
        lastTrackId: selectedTrackId,
        queue: queueRef.current,
        mode: sessionMode
      }));
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const openAudioFiles = window?.hound?.openAudioFiles;
      if (typeof openAudioFiles !== "function") {
        console.warn("[Hound] window.hound.openAudioFiles is unavailable.");
        setImportError("Import is unavailable in this mode. Use the Electron app.");
        return;
      }
      const result = await openAudioFiles();
      if (!Array.isArray(result) || result.length === 0) return;
      setImportError("");
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
              liked: false,
              gain: 1,
              loudnessReady: false
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
    setImportError("");
    stopAllAudio();
    setCurrentTime(0);
    setDuration(0);
  };

  const handleRowClick = (trackId) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return;
    shuffleHistoryRef.current = [];
    if (shuffleOn) {
      shuffleOrderRef.current = [trackId];
    }
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
    shuffleOrderRef.current = selectedTrack ? [selectedTrack.id] : [];
  };

  const moveQueueItem = (index, direction) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const moveQueueItemTo = (fromIndex, toIndex) => {
    setQueue((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const removeQueueItem = (index) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const queueItems = useMemo(() => {
    return queue
      .map((id) => tracks.find((track) => track.id === id))
      .filter(Boolean);
  }, [queue, tracks]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const createPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPlaylists((prev) => [...prev, { id, name, trackIds: [] }]);
    setSelectedPlaylistId(id);
    setNewPlaylistName("");
  };

  useEffect(() => {
    if (!selectedPlaylistId) return;
    setLastSession((prev) => ({
      ...prev,
      playlistId: selectedPlaylistId,
      mode: sessionMode
    }));
  }, [selectedPlaylistId, sessionMode]);

  const openAlbum = (name) => {
    if (!name) return;
    setActiveAlbum(name);
    setScreen("album");
  };

  const openArtist = (name) => {
    if (!name) return;
    setActiveArtist(name);
    setScreen("artist");
  };

  const resumeLastSession = (mode) => {
    if (!lastSession || !lastSession.lastTrackId) return;
    const index = tracks.findIndex((track) => track.id === lastSession.lastTrackId);
    if (index === -1) return;
    setSessionMode(mode);
    setQueue(Array.isArray(lastSession.queue) ? lastSession.queue : []);
    goToTrack(index);
  };

  const continueQueue = () => {
    if (!lastSession || !Array.isArray(lastSession.queue)) return;
    setQueue(lastSession.queue);
  };

  const continuePlaylist = () => {
    if (!lastSession || !lastSession.playlistId) return;
    setSelectedPlaylistId(lastSession.playlistId);
    setScreen("playlist");
  };

  const playAlbum = () => {
    if (albumTracks.length === 0) return;
    const index = tracks.findIndex((track) => track.id === albumTracks[0].id);
    if (index >= 0) goToTrack(index);
  };

  const shuffleAlbum = () => {
    if (albumTracks.length === 0) return;
    const pick = albumTracks[Math.floor(Math.random() * albumTracks.length)];
    const index = tracks.findIndex((track) => track.id === pick.id);
    if (index >= 0) goToTrack(index);
  };

  const addAlbumToPlaylist = () => {
    if (!albumPlaylistId || albumTracks.length === 0) return;
    albumTracks.forEach((track) => addTrackToPlaylist(albumPlaylistId, track.id));
  };

  const playArtist = () => {
    if (artistTracks.length === 0) return;
    const index = tracks.findIndex((track) => track.id === artistTracks[0].id);
    if (index >= 0) goToTrack(index);
  };

  const shuffleArtist = () => {
    if (artistTracks.length === 0) return;
    const pick = artistTracks[Math.floor(Math.random() * artistTracks.length)];
    const index = tracks.findIndex((track) => track.id === pick.id);
    if (index >= 0) goToTrack(index);
  };

  const addArtistToPlaylist = () => {
    if (!artistPlaylistId || artistTracks.length === 0) return;
    artistTracks.forEach((track) => addTrackToPlaylist(artistPlaylistId, track.id));
  };

  const playPlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.trackIds.length === 0) return;
    const firstId = selectedPlaylist.trackIds[0];
    const index = tracks.findIndex((track) => track.id === firstId);
    if (index >= 0) goToTrack(index);
  };

  const addTrackToPlaylist = (playlistId, trackId) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        if (playlist.trackIds.includes(trackId)) return playlist;
        return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
      })
    );
  };

  const removeTrackFromPlaylist = (playlistId, trackId) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        return {
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => id !== trackId)
        };
      })
    );
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(null);
    }
  };

  const activeScreen = screen === "player" ? "player" : "library";
  const activePage =
    screen === "queue"
      ? "queue"
      : screen === "playlist"
        ? "playlist"
        : screen === "search"
          ? "search"
          : screen === "history"
            ? "history"
            : screen === "settings"
              ? "settings"
              : screen === "album"
                ? "album"
                : screen === "artist"
                  ? "artist"
                  : screen === "home"
                    ? "home"
                    : activeScreen;
  const likedTracks = useMemo(() => tracks.filter((track) => track.liked), [tracks]);
  const query = searchQuery.trim().toLowerCase();
  const searchTracks = query
    ? tracks.filter(
        (track) =>
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          getAlbumName(track).toLowerCase().includes(query)
      )
    : [];
  const searchPlaylists = query
    ? playlists.filter((playlist) => playlist.name.toLowerCase().includes(query))
    : [];
  const searchLiked = query
    ? likedTracks.filter(
        (track) =>
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query)
      )
    : [];
  const albumTracks = activeAlbum
    ? tracks.filter((track) => getAlbumName(track) === activeAlbum)
    : [];
  const artistTracks = activeArtist
    ? tracks.filter((track) => track.artist === activeArtist)
    : [];
  const artistAlbums = useMemo(() => {
    if (!activeArtist) return [];
    const albumSet = new Set(artistTracks.map((track) => getAlbumName(track)));
    return Array.from(albumSet);
  }, [activeArtist, artistTracks]);

  return (
    <div style={styles.app}>
      <header style={styles.topBar}>
        <div style={styles.brand}>HOUND</div>
        <div style={styles.nav}>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("home")}
          >
            Home
          </button>
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
            onClick={() => setScreen("search")}
          >
            Search
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
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("queue")}
          >
            Queue
          </button>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("playlist")}
          >
            Playlists
          </button>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("history")}
          >
            History
          </button>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => setScreen("settings")}
          >
            Settings
          </button>
        </div>
      </header>

      <main style={styles.content}>
        {activePage === "home" ? (
          <section style={styles.homePage}>
            <div style={styles.homeCard}>
              <div style={styles.homeCardTitle}>Now</div>
              {selectedTrack && isPlaying ? (
                <div>
                  Playing: {selectedTrack.title} - {selectedTrack.artist}
                </div>
              ) : (
                <div>Nothing playing.</div>
              )}
            </div>
            <div style={styles.homeCard}>
              <div style={styles.homeCardTitle}>Resume last session</div>
              <div style={styles.rowArtist}>
                Last track:{" "}
                {lastSession && lastSession.lastTrackId
                  ? getFileName(lastSession.lastTrackId)
                  : "None"}
              </div>
              <div style={styles.homeActions}>
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={() => resumeLastSession("Normal")}
                  disabled={!lastSession || !lastSession.lastTrackId}
                >
                  Resume Normal
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => resumeLastSession("Wild")}
                  disabled={!lastSession || !lastSession.lastTrackId}
                >
                  Resume Wild
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={continueQueue}
                  disabled={!lastSession || !Array.isArray(lastSession.queue)}
                >
                  Continue Queue
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={continuePlaylist}
                  disabled={!lastSession || !lastSession.playlistId}
                >
                  Continue Playlist
                </button>
              </div>
            </div>
            <div style={styles.homeCard}>
              <div style={styles.homeCardTitle}>Entry points</div>
              <div style={styles.homeActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setScreen("library")}
                >
                  Library
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setScreen("playlist")}
                >
                  Playlists
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setScreen("queue")}
                >
                  Queue
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setSessionMode("Wild");
                    setScreen("player");
                  }}
                  disabled={tracks.length === 0}
                >
                  Wild Mode
                </button>
              </div>
            </div>
          </section>
        ) : activePage === "library" ? (
          <section style={styles.library}>
            <div style={styles.libraryButtons}>
              <button type="button" style={styles.primaryButton} onClick={handleImport}>
                Import
              </button>
              <button type="button" style={styles.secondaryButton} onClick={clearLibrary}>
                Clear Library
              </button>
            </div>
            {settings.loudnessEnabled && tracks.some((track) => !track.loudnessReady) ? (
              <div style={styles.rowArtist}>
                Analyzing loudness... playback stays available.
              </div>
            ) : null}
            {importError ? <div style={styles.errorBanner}>{importError}</div> : null}
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
                        {settings.loudnessEnabled && !track.loudnessReady ? (
                          <span style={styles.badge}>Analyzing</span>
                        ) : null}
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            openAlbum(getAlbumName(track));
                          }}
                        >
                          Album
                        </button>
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            openArtist(track.artist);
                          }}
                        >
                          Artist
                        </button>
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
        ) : activePage === "search" ? (
          <section style={styles.searchPage}>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tracks, artists, albums, playlists"
              style={styles.input}
            />
            {!query ? (
              <div style={styles.empty}>Type to search your library.</div>
            ) : (
              <>
                <div style={styles.listTitle}>Tracks</div>
                <ul style={styles.list}>
                  {searchTracks.map((track) => (
                    <li
                      key={track.id}
                      style={styles.row(track.id === selectedTrackId)}
                      onClick={() => handleRowClick(track.id)}
                    >
                      <div style={styles.rowTitle}>
                        <span>{track.title}</span>
                        <div style={styles.rowActions}>
                          {track.liked ? <span aria-label="liked">&lt;3</span> : null}
                        </div>
                      </div>
                      <div style={styles.rowArtist}>{track.artist}</div>
                    </li>
                  ))}
                  {searchTracks.length === 0 ? (
                    <li style={styles.empty}>No track matches.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Playlists</div>
                <ul style={styles.list}>
                  {searchPlaylists.map((playlist) => (
                    <li
                      key={playlist.id}
                      style={styles.row(playlist.id === selectedPlaylistId)}
                      onClick={() => {
                        setSelectedPlaylistId(playlist.id);
                        setScreen("playlist");
                      }}
                    >
                      <div style={styles.rowTitle}>
                        <span>{playlist.name}</span>
                        <span style={styles.badge}>{playlist.trackIds.length} tracks</span>
                      </div>
                    </li>
                  ))}
                  {searchPlaylists.length === 0 ? (
                    <li style={styles.empty}>No playlist matches.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Liked Songs</div>
                <ul style={styles.list}>
                  {searchLiked.map((track) => (
                    <li
                      key={track.id}
                      style={styles.row(track.id === selectedTrackId)}
                      onClick={() => handleRowClick(track.id)}
                    >
                      <div style={styles.rowTitle}>
                        <span>{track.title}</span>
                        <span aria-label="liked">&lt;3</span>
                      </div>
                      <div style={styles.rowArtist}>{track.artist}</div>
                    </li>
                  ))}
                  {searchLiked.length === 0 ? (
                    <li style={styles.empty}>No liked matches.</li>
                  ) : null}
                </ul>
                {searchTracks.length === 0 &&
                searchPlaylists.length === 0 &&
                searchLiked.length === 0 ? (
                  <div style={styles.empty}>No results found.</div>
                ) : null}
              </>
            )}
          </section>
        ) : activePage === "history" ? (
          <section style={styles.searchPage}>
            <div style={styles.listTitle}>Session History</div>
            <ul style={styles.list}>
              {sessionHistory.map((entry) => (
                <li
                  key={entry.id}
                  style={styles.row(false)}
                  onClick={() => setRecap(entry.payload)}
                >
                  <div style={styles.rowTitle}>
                    <span>{new Date(entry.date).toLocaleString()}</span>
                    <span style={styles.badge}>{entry.mode || "Normal"}</span>
                  </div>
                  <div style={styles.rowArtist}>
                    Duration: {entry.payload.listenedSeconds}s
                  </div>
                </li>
              ))}
              {sessionHistory.length === 0 ? (
                <li style={styles.empty}>No sessions yet.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "settings" ? (
          <section style={styles.settingsPage}>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Audio</div>
              <div style={styles.settingRow}>
                <span>Loudness normalization</span>
                <input
                  type="checkbox"
                  checked={settings.loudnessEnabled}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      loudnessEnabled: event.target.checked
                    }))
                  }
                />
              </div>
              <div style={styles.settingRow}>
                <span>Crossfade</span>
                <input
                  type="checkbox"
                  checked={settings.crossfadeEnabled}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      crossfadeEnabled: event.target.checked
                    }))
                  }
                />
              </div>
              <div style={styles.settingRow}>
                <span>Gap duration: {Math.max(1, settings.gapSeconds)}s</span>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={settings.gapSeconds}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      gapSeconds: Number(event.target.value)
                    }))
                  }
                />
              </div>
            </div>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Playback</div>
              <div style={styles.settingRow}>
                <span>Resume on launch</span>
                <input
                  type="checkbox"
                  checked={settings.resumeOnLaunch}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      resumeOnLaunch: event.target.checked
                    }))
                  }
                />
              </div>
              <div style={styles.settingRow}>
                <span>Stop ends session</span>
                <input
                  type="checkbox"
                  checked={settings.stopEndsSession}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      stopEndsSession: event.target.checked
                    }))
                  }
                />
              </div>
            </div>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Data & Privacy</div>
              <div style={styles.rowArtist}>
                Local-only listening. No network or accounts.
              </div>
              <div style={styles.homeActions}>
                <button type="button" style={styles.secondaryButton} onClick={clearLibrary}>
                  Clear Library
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setSessionHistory([])}
                >
                  Reset Sessions
                </button>
              </div>
            </div>
          </section>
        ) : activePage === "album" ? (
          <section style={styles.playlistPage}>
            <div style={styles.listTitle}>Album</div>
            <div style={styles.rowArtist}>{activeAlbum || "Unknown Album"}</div>
            <div style={styles.homeActions}>
              <button type="button" style={styles.secondaryButton} onClick={playAlbum}>
                Play Album
              </button>
              <button type="button" style={styles.secondaryButton} onClick={shuffleAlbum}>
                Shuffle Album
              </button>
            </div>
            <div style={styles.homeActions}>
              <select
                value={albumPlaylistId}
                onChange={(event) => setAlbumPlaylistId(event.target.value)}
                style={styles.input}
              >
                <option value="">Add album to playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={addAlbumToPlaylist}
                disabled={!albumPlaylistId}
              >
                Add
              </button>
            </div>
            <ul style={styles.list}>
              {albumTracks.map((track) => (
                <li
                  key={track.id}
                  style={styles.row(track.id === selectedTrackId)}
                  onClick={() => handleRowClick(track.id)}
                >
                  <div style={styles.rowTitle}>
                    <span>{track.title}</span>
                    {track.liked ? <span aria-label="liked">&lt;3</span> : null}
                  </div>
                  <div style={styles.rowArtist}>{track.artist}</div>
                </li>
              ))}
              {albumTracks.length === 0 ? (
                <li style={styles.empty}>No album tracks found.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "artist" ? (
          <section style={styles.playlistPage}>
            <div style={styles.listTitle}>Artist</div>
            <div style={styles.rowArtist}>{activeArtist || "Unknown Artist"}</div>
            <div style={styles.homeActions}>
              <button type="button" style={styles.secondaryButton} onClick={playArtist}>
                Play Artist
              </button>
              <button type="button" style={styles.secondaryButton} onClick={shuffleArtist}>
                Shuffle Artist
              </button>
            </div>
            <div style={styles.homeActions}>
              <select
                value={artistPlaylistId}
                onChange={(event) => setArtistPlaylistId(event.target.value)}
                style={styles.input}
              >
                <option value="">Add artist to playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={addArtistToPlaylist}
                disabled={!artistPlaylistId}
              >
                Add
              </button>
            </div>
            <div style={styles.listTitle}>Albums</div>
            <ul style={styles.list}>
              {artistAlbums.map((album) => (
                <li
                  key={album}
                  style={styles.row(false)}
                  onClick={() => openAlbum(album)}
                >
                  <div style={styles.rowTitle}>
                    <span>{album}</span>
                  </div>
                </li>
              ))}
              {artistAlbums.length === 0 ? (
                <li style={styles.empty}>No albums found.</li>
              ) : null}
            </ul>
            <div style={styles.listTitle}>Tracks</div>
            <ul style={styles.list}>
              {artistTracks.map((track) => (
                <li
                  key={track.id}
                  style={styles.row(track.id === selectedTrackId)}
                  onClick={() => handleRowClick(track.id)}
                >
                  <div style={styles.rowTitle}>
                    <span>{track.title}</span>
                    {track.liked ? <span aria-label="liked">&lt;3</span> : null}
                  </div>
                  <div style={styles.rowArtist}>{track.artist}</div>
                </li>
              ))}
              {artistTracks.length === 0 ? (
                <li style={styles.empty}>No tracks found.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "queue" ? (
          <section style={styles.queuePage}>
            <div style={styles.queueNowPlaying}>
              <div style={styles.queueNowLabel}>Now Playing</div>
              {selectedTrack ? (
                <>
                  <div style={styles.queueNowTitle}>{selectedTrack.title}</div>
                  <div style={styles.queueNowArtist}>{selectedTrack.artist}</div>
                </>
              ) : (
                <div style={styles.queueNowArtist}>Nothing selected.</div>
              )}
            </div>
            <div style={styles.queuePanel}>
              <div style={styles.queueHeader}>
                <span>Play Next Queue</span>
                <button
                  type="button"
                  style={styles.queueActionButton}
                  onClick={clearQueue}
                  disabled={queue.length === 0}
                >
                  Clear
                </button>
              </div>
              {queueItems.length === 0 ? (
                <div style={styles.empty}>Queue is empty.</div>
              ) : (
                <ul style={styles.queueList}>
                  {queueItems.map((track, index) => (
                    <li
                      key={`${track.id}-${index}`}
                      style={styles.queueRow}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", String(index));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const raw = event.dataTransfer.getData("text/plain");
                        const fromIndex = Number(raw);
                        if (Number.isFinite(fromIndex)) {
                          moveQueueItemTo(fromIndex, index);
                        }
                      }}
                    >
                      <div style={styles.queueMeta}>
                        <span style={styles.queueTitle}>{track.title}</span>
                        <span style={styles.queueArtist}>{track.artist}</span>
                      </div>
                      <div style={styles.queueActions}>
                        {settings.loudnessEnabled && !track.loudnessReady ? (
                          <span style={styles.badge}>Analyzing</span>
                        ) : null}
                        <button
                          type="button"
                          style={styles.queueDrag}
                          aria-label="Drag to reorder"
                        >
                          Drag
                        </button>
                        <button
                          type="button"
                          style={styles.queueActionButton}
                          onClick={() => removeQueueItem(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : activePage === "playlist" ? (
          <section style={styles.playlistPage}>
            <div style={styles.libraryButtons}>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                placeholder="New playlist name"
                style={{
                  flex: 1,
                  minWidth: "200px",
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#e5e7eb",
                  padding: "10px 12px",
                  borderRadius: "8px"
                }}
              />
              <button type="button" style={styles.primaryButton} onClick={createPlaylist}>
                Create Playlist
              </button>
            </div>
            <div style={styles.listTitle}>Your Playlists</div>
            <ul style={styles.list}>
              {playlists.map((playlist) => (
                <li
                  key={playlist.id}
                  style={styles.row(playlist.id === selectedPlaylistId)}
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                >
                  <div style={styles.rowTitle}>
                    <span>{playlist.name}</span>
                    <div style={styles.rowActions}>
                      <span style={styles.badge}>{playlist.trackIds.length} tracks</span>
                      <button
                        type="button"
                        style={styles.queueButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePlaylist(playlist.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {playlists.length === 0 ? (
                <li style={styles.empty}>No playlists yet.</li>
              ) : null}
            </ul>
            <div style={styles.listTitle}>Liked Songs</div>
            <ul style={styles.list}>
              {likedTracks.map((track) => (
                <li
                  key={track.id}
                  style={styles.row(track.id === selectedTrackId)}
                  onClick={() => handleRowClick(track.id)}
                >
                  <div style={styles.rowTitle}>
                    <span>{track.title}</span>
                    <div style={styles.rowActions}>
                      <span aria-label="liked">&lt;3</span>
                      {settings.loudnessEnabled && !track.loudnessReady ? (
                        <span style={styles.badge}>Analyzing</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={styles.rowArtist}>{track.artist}</div>
                </li>
              ))}
              {likedTracks.length === 0 ? (
                <li style={styles.empty}>No liked songs yet.</li>
              ) : null}
            </ul>
            <div style={styles.listTitle}>Playlist Tracks</div>
            {selectedPlaylist ? (
              <>
                <div style={styles.rowArtist}>{selectedPlaylist.name}</div>
                <div style={styles.homeActions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={playPlaylist}
                    disabled={selectedPlaylist.trackIds.length === 0}
                  >
                    Play Playlist
                  </button>
                </div>
                <ul style={styles.list}>
                  {selectedPlaylist.trackIds.map((trackId) => {
                    const track = tracks.find((item) => item.id === trackId);
                    if (!track) return null;
                    return (
                      <li
                        key={track.id}
                        style={styles.row(track.id === selectedTrackId)}
                        onClick={() => handleRowClick(track.id)}
                      >
                        <div style={styles.rowTitle}>
                          <span>{track.title}</span>
                          <div style={styles.rowActions}>
                            {settings.loudnessEnabled && !track.loudnessReady ? (
                              <span style={styles.badge}>Analyzing</span>
                            ) : null}
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeTrackFromPlaylist(selectedPlaylist.id, track.id);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div style={styles.rowArtist}>{track.artist}</div>
                      </li>
                    );
                  })}
                  {selectedPlaylist.trackIds.length === 0 ? (
                    <li style={styles.empty}>Playlist is empty.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Add Tracks</div>
                <ul style={styles.list}>
                  {tracks
                    .filter((track) => !selectedPlaylist.trackIds.includes(track.id))
                    .map((track) => {
                    const inPlaylist = selectedPlaylist.trackIds.includes(track.id);
                    return (
                      <li key={track.id} style={styles.row(false)}>
                        <div style={styles.rowTitle}>
                          <span>{track.title}</span>
                          <div style={styles.rowActions}>
                            {inPlaylist ? <span style={styles.badge}>Added</span> : null}
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={() =>
                                addTrackToPlaylist(selectedPlaylist.id, track.id)
                              }
                              disabled={inPlaylist}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <div style={styles.rowArtist}>{track.artist}</div>
                      </li>
                    );
                  })}
                  {tracks.length === 0 ? (
                    <li style={styles.empty}>Import tracks to add.</li>
                  ) : null}
                </ul>
              </>
            ) : (
              <div style={styles.empty}>Select a playlist to view tracks.</div>
            )}
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
                        Back to Front
                      </button>
                      <button
                        type="button"
                        style={styles.flipButton}
                        onClick={() => setScreen("queue")}
                      >
                        Queue
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
                      <div style={{ minHeight: "48px" }}>
                        <h2 style={styles.trackTitle}>
                          <MarqueeText text={selectedTrack.title} maxChars={22} />
                        </h2>
                        <p style={styles.trackArtist}>
                          <MarqueeText text={selectedTrack.artist} maxChars={28} />
                        </p>
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
                          Prev
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.controlButton, ...styles.playButton }}
                          onClick={togglePlayPause}
                          aria-label="Play/Pause"
                        >
                          {isPlaying ? "Pause" : "Play"}
                        </button>
                        <button
                          type="button"
                          style={styles.controlButton}
                          onClick={handleNext}
                          aria-label="Next"
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          style={styles.controlButton}
                          onClick={handleStop}
                          aria-label="Stop"
                        >
                          Stop
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
                          {selectedTrack.liked ? "Unlike" : "Like"}
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
                          Shuffle
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
                        Flip
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

      {activePage !== "player" && selectedTrack ? (
        <div
          style={styles.nowPlayingBar}
          onClick={() => setScreen("player")}
          role="button"
          tabIndex={0}
        >
          <div style={styles.nowPlayingInfo}>
            <div style={{ minWidth: 0 }}>
              <MarqueeText text={selectedTrack.title} maxChars={24} />
              <MarqueeText text={selectedTrack.artist} maxChars={28} />
            </div>
          </div>
          <div style={styles.nowPlayingControls}>
            <button
              type="button"
              style={styles.nowPlayingButton}
              onClick={(event) => {
                event.stopPropagation();
                handlePrev();
              }}
            >
              Prev
            </button>
            <button
              type="button"
              style={styles.nowPlayingButton}
              onClick={(event) => {
                event.stopPropagation();
                togglePlayPause();
              }}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              style={styles.nowPlayingButton}
              onClick={(event) => {
                event.stopPropagation();
                handleNext();
              }}
            >
              Next
            </button>
          </div>
          <div style={styles.nowPlayingProgressWrap}>
            <div
              style={{
                ...styles.nowPlayingProgress,
                width: duration > 0 ? `${Math.min((currentTime / duration) * 100, 100)}%` : "0%"
              }}
            />
          </div>
          <div style={styles.nowPlayingTime}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      ) : null}

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




