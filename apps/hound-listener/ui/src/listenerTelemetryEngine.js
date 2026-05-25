import {
  ingestTrackForWorld,
  evaluateSessionSummary,
  LISTENER_GLOBAL_FAVORITES_ORBIT
} from "./rulesEngineBridge.js";

export function createSessionId() {
  return `listener-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getTimeOfDayLabel(iso = new Date().toISOString()) {
  const hour = new Date(iso).getHours();
  if (hour < 5) return "late_night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function getLocationContext() {
  try {
    const fromHost = window?.Hound?.getLocationContext?.();
    if (typeof fromHost === "string" && fromHost.trim()) return fromHost.trim();
  } catch {
    // ignore host integration errors
  }
  return "unknown_place";
}

export function buildTelemetryEvent({
  type,
  track = null,
  world = "Normal",
  sessionId,
  payload = {}
}) {
  const timestamp = new Date().toISOString();
  return {
    type,
    world,
    sessionId,
    timestamp,
    timeOfDay: getTimeOfDayLabel(timestamp),
    locationContext: getLocationContext(),
    trackId: track?.id || null,
    artistId: track?.artistId || track?.cloudArtistId || null,
    ...payload
  };
}

export function evaluateListenerSession({ tracks = [], events = [], policy = {} }) {
  const preparedTracks = (tracks || []).map((track) => {
    if (track.saved) {
      return {
        ...track,
        globalOrbit: LISTENER_GLOBAL_FAVORITES_ORBIT,
        worldOrbit: null
      };
    }
    const ingested = ingestTrackForWorld(track);
    return {
      ...track,
      worldOrbit: track.worldOrbit || ingested.worldOrbit,
      globalOrbit: null
    };
  });

  return evaluateSessionSummary({
    tracks: preparedTracks,
    events,
    policy
  });
}
