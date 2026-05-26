import {
  ingestTrackForWorld,
  evaluateSessionSummary,
  LISTENER_GLOBAL_FAVORITES_ORBIT
} from "./rulesEngineBridge.js";

export const RAW_SONG_EVENT_NAMES = Object.freeze([
  "track_started",
  "track_skipped",
  "track_finished",
  "track_replayed",
  "favorite_toggled",
  "archive_restored",
  "next_track_selected"
]);

const LEARNING_EVENT_NAMES = new Set([
  "track_skipped",
  "track_finished",
  "track_replayed"
]);

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

export function buildRawSongEvent({
  eventName,
  track = null,
  sessionId,
  payload = {}
}) {
  if (!RAW_SONG_EVENT_NAMES.includes(eventName)) {
    throw new Error(`Unknown raw song event: ${eventName}`);
  }
  return {
    event_id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event_name: eventName,
    ts: new Date().toISOString(),
    session_id: sessionId,
    track_id: track?.id || null,
    payload: { ...payload },
    schema_version: 1
  };
}

export function rawSongEventsToLearningSignals(rawEvents = [], { earlySkipThresholdPercent = 25 } = {}) {
  return (rawEvents || [])
    .filter((event) =>
      event?.track_id &&
      RAW_SONG_EVENT_NAMES.includes(event?.event_name) &&
      LEARNING_EVENT_NAMES.has(event?.event_name)
    )
    .map((event) => {
      const payload = event.payload || {};
      const percentListened = Number(payload.percent_listened ?? payload.percentListened ?? 0);
      const skippedEarly = Boolean(payload.skipped_early ?? payload.skippedEarly ?? percentListened <= earlySkipThresholdPercent);
      const manualSkip = Boolean(payload.manual_skip ?? payload.manualSkip ?? event.event_name === "track_skipped");
      const completedPlay = Boolean(payload.completed_play ?? payload.completedPlay ?? event.event_name === "track_finished");
      const replayedSameSession = Number(payload.replayed_same_session ?? payload.replayedSameSession ?? (event.event_name === "track_replayed" ? 1 : 0));
      return {
        trackId: event.track_id,
        sessionId: event.session_id,
        timestamp: event.ts,
        world: payload.world || "Normal",
        percentListened,
        skippedEarly,
        manualSkip,
        completedPlay,
        replayedSameSession
      };
    });
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
