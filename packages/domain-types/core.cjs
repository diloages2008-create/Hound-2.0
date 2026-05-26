const ORBITS = Object.freeze({
  ROTATION: "rotation",
  RECENT: "recent",
  DISCOVERY: "discovery"
});

const WORLD_ORBITS = Object.freeze({
  ORBIT_1: "orbit_1",
  ORBIT_2: "orbit_2",
  ORBIT_3: "orbit_3"
});

const HOUND_TERMS = Object.freeze({
  LISTENER: "listener",
  MOOD: "mood",
  WORLD: "world",
  FAVORITES: "favorites",
  ARCHIVE: "archive",
  NEW_MOOD: "new_mood"
});

const ROTATION_OVERRIDE = Object.freeze({
  NONE: "none",
  FORCE_ON: "force_on",
  FORCE_OFF: "force_off"
});

const PLAY_EVENT_KEYS = Object.freeze([
  "play_start_time",
  "play_end_time",
  "play_duration_seconds",
  "track_total_duration",
  "percent_listened",
  "skipped_early",
  "replayed_same_session",
  "completed_play",
  "manual_skip",
  "auto_advance",
  "timestamp"
]);

const DEFAULT_TRACK = Object.freeze({
  id: "",
  title: "",
  artist: "",
  album: null,
  genre: null,
  moodTags: [],
  saved: false,
  rotation: false,
  rotationOverride: ROTATION_OVERRIDE.NONE,
  rotationScore: 0,
  worldOrbit: WORLD_ORBITS.ORBIT_3,
  playCountTotal: 0,
  orbit: null,
  lastPositiveListenAt: null,
  lastNegativeListenAt: null,
  playHistory: []
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toISO(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeTrack(rawTrack = {}) {
  const next = {
    ...DEFAULT_TRACK,
    ...rawTrack
  };

  next.rotationScore = clamp(Number(next.rotationScore) || 0, 0, 100);
  next.playCountTotal = Math.max(0, Number(next.playCountTotal) || 0);
  next.saved = Boolean(next.saved);
  next.rotation = Boolean(next.rotation);
  next.rotationOverride = Object.values(ROTATION_OVERRIDE).includes(next.rotationOverride)
    ? next.rotationOverride
    : ROTATION_OVERRIDE.NONE;
  next.worldOrbit = Object.values(WORLD_ORBITS).includes(next.worldOrbit)
    ? next.worldOrbit
    : WORLD_ORBITS.ORBIT_3;
  next.moodTags = Array.isArray(next.moodTags)
    ? next.moodTags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];
  next.lastPositiveListenAt = toISO(next.lastPositiveListenAt);
  next.lastNegativeListenAt = toISO(next.lastNegativeListenAt);
  next.playHistory = Array.isArray(next.playHistory) ? next.playHistory : [];

  if (!next.id || typeof next.id !== "string") {
    throw new Error("Track requires a non-empty string id");
  }

  return next;
}

function validatePlayEvent(event) {
  if (!event || typeof event !== "object") return false;
  return PLAY_EVENT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(event, key));
}

module.exports = {
  ORBITS,
  WORLD_ORBITS,
  HOUND_TERMS,
  ROTATION_OVERRIDE,
  PLAY_EVENT_KEYS,
  DEFAULT_TRACK,
  clamp,
  toISO,
  normalizeTrack,
  validatePlayEvent
};
