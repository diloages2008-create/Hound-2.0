const {
  ORBITS,
  WORLD_ORBITS,
  ROTATION_OVERRIDE,
  normalizeTrack,
  clamp
} = require("@hound/domain-types");

const DEFAULT_POLICY = Object.freeze({
  rotationScoreThreshold: 55,
  recentWindowHours: 72,
  maxRecentTracks: 50,
  earlySkipThresholdPercent: 25,
  replayBonus: 8,
  completionBonus: 12,
  earlySkipPenalty: 16,
  saveBonus: 10,
  forceOnScoreFloor: 65,
  promotionScoreFloorOrbit2: 45,
  promotionScoreFloorOrbit1: 70,
  demotionScoreFloorOrbit1: 60,
  demotionScoreFloorOrbit2: 35,
  moodSwitchSkipThreshold: 4,
  consecutiveWorldSkipThreshold: 3,
  archiveReentryMax: 3,
  minPositiveSessionsForPromotion: 2,
  minSkipSessionsForDemotion: 2
});

function withPolicy(policy = {}) {
  return { ...DEFAULT_POLICY, ...policy };
}

const LISTENER_GLOBAL_FAVORITES_ORBIT = "listener_orbit_1";

function isFavoriteTrack(track = {}) {
  return Boolean(track.saved || track.isFavorite);
}

function scoreTrackFromTelemetry(track, telemetry = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  const safeTrack = normalizeTrack(track);
  const events = Array.isArray(telemetry) ? telemetry : [];

  let score = safeTrack.rotationScore;
  for (const event of events) {
    const listened = Number(event.percent_listened) || 0;
    if (event.completed_play || listened >= 90) score += nextPolicy.completionBonus;
    if (event.replayed_same_session > 0) score += nextPolicy.replayBonus;
    if (event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent) {
      score -= nextPolicy.earlySkipPenalty;
    }
  }

  if (safeTrack.saved) score += nextPolicy.saveBonus;
  if (safeTrack.rotationOverride === ROTATION_OVERRIDE.FORCE_ON) {
    score = Math.max(score, nextPolicy.forceOnScoreFloor);
  }
  if (safeTrack.rotationOverride === ROTATION_OVERRIDE.FORCE_OFF) {
    score = 0;
  }

  const rotationScore = clamp(score, 0, 100);
  const rotation =
    safeTrack.rotationOverride === ROTATION_OVERRIDE.FORCE_ON ||
    (safeTrack.rotationOverride !== ROTATION_OVERRIDE.FORCE_OFF &&
      rotationScore >= nextPolicy.rotationScoreThreshold);

  return {
    ...safeTrack,
    rotationScore,
    rotation
  };
}

function buildOrbitPools(tracks, nowISO = new Date().toISOString(), policy = {}) {
  const nextPolicy = withPolicy(policy);
  const now = new Date(nowISO);
  const recentCutoffMs = nextPolicy.recentWindowHours * 60 * 60 * 1000;

  const pools = {
    [ORBITS.ROTATION]: [],
    [ORBITS.RECENT]: [],
    [ORBITS.DISCOVERY]: []
  };

  const normalized = (tracks || []).map((track) => normalizeTrack(track));
  for (const track of normalized) {
    const hasPlayHistory = track.playHistory.length > 0 || track.playCountTotal > 0;
    const positiveDelta = track.lastPositiveListenAt
      ? now.getTime() - new Date(track.lastPositiveListenAt).getTime()
      : Number.POSITIVE_INFINITY;

    if (track.rotation || track.rotationOverride === ROTATION_OVERRIDE.FORCE_ON) {
      pools[ORBITS.ROTATION].push({ ...track, orbit: ORBITS.ROTATION });
      continue;
    }

    if (hasPlayHistory && positiveDelta <= recentCutoffMs) {
      pools[ORBITS.RECENT].push({ ...track, orbit: ORBITS.RECENT });
      continue;
    }

    pools[ORBITS.DISCOVERY].push({ ...track, orbit: ORBITS.DISCOVERY });
  }

  pools[ORBITS.RECENT] = pools[ORBITS.RECENT]
    .sort((a, b) => {
      const aTs = a.lastPositiveListenAt ? new Date(a.lastPositiveListenAt).getTime() : 0;
      const bTs = b.lastPositiveListenAt ? new Date(b.lastPositiveListenAt).getTime() : 0;
      return bTs - aTs;
    })
    .slice(0, nextPolicy.maxRecentTracks);

  return pools;
}

function pickNextTrack({ tracks, queue = [], currentTrackId = null, policy = {} }) {
  const nextPolicy = withPolicy(policy);
  const normalized = (tracks || []).map((track) => normalizeTrack(track));

  if (queue.length > 0) {
    const queued = normalized.find((track) => track.id === queue[0]);
    if (queued) return { track: queued, reason: "queue" };
  }

  const pools = buildOrbitPools(normalized, new Date().toISOString(), nextPolicy);
  const pickOrder = [ORBITS.ROTATION, ORBITS.RECENT, ORBITS.DISCOVERY];

  for (const orbit of pickOrder) {
    const candidates = pools[orbit].filter((track) => track.id !== currentTrackId);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.rotationScore - a.rotationScore || a.title.localeCompare(b.title));
      return { track: candidates[0], reason: `orbit:${orbit}` };
    }
  }

  return { track: null, reason: "empty" };
}

function resolveWorldOrbit(track, policy = {}) {
  const nextPolicy = withPolicy(policy);
  const safeTrack = normalizeTrack(track);
  if (isFavoriteTrack(safeTrack) || safeTrack.rotationOverride === ROTATION_OVERRIDE.FORCE_ON) {
    return WORLD_ORBITS.ORBIT_1;
  }
  if (safeTrack.rotationScore >= nextPolicy.promotionScoreFloorOrbit1) return WORLD_ORBITS.ORBIT_1;
  if (safeTrack.rotationScore >= nextPolicy.promotionScoreFloorOrbit2) return WORLD_ORBITS.ORBIT_2;
  return WORLD_ORBITS.ORBIT_3;
}

function countConsecutiveSkips(events = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  const ordered = [...(events || [])].sort((a, b) => {
    const aTs = new Date(a.timestamp || 0).getTime();
    const bTs = new Date(b.timestamp || 0).getTime();
    return aTs - bTs;
  });
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const event = ordered[i];
    const listened = Number(event.percent_listened) || 0;
    const skipped = Boolean(event.manual_skip || event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent);
    if (!skipped) break;
    streak += 1;
  }
  return streak;
}

function isWorldSkipSpree(events = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  return countConsecutiveSkips(events, nextPolicy) >= nextPolicy.consecutiveWorldSkipThreshold;
}

function getWorldSkipSpreeEvents(events = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  const ordered = [...(events || [])].sort((a, b) => {
    const aTs = new Date(a.timestamp || 0).getTime();
    const bTs = new Date(b.timestamp || 0).getTime();
    return aTs - bTs;
  });
  const spree = [];
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const event = ordered[i];
    const listened = Number(event.percent_listened) || 0;
    const skipped = Boolean(event.manual_skip || event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent);
    if (!skipped) break;
    spree.push(event);
  }
  if (spree.length < nextPolicy.consecutiveWorldSkipThreshold) return [];
  return spree;
}

function shouldCountSkipsAgainstTrack({ worldRecentEvents = [], policy = {} }) {
  return !isWorldSkipSpree(worldRecentEvents, policy);
}

function toSessionKey(event, idx = 0) {
  if (event?.sessionId) return String(event.sessionId);
  if (event?.session_id) return String(event.session_id);
  if (event?.timestamp) {
    const d = new Date(event.timestamp);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return `unknown_${idx}`;
}

function countDistinctSkipSessions(events = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  const sessions = new Set();
  (events || []).forEach((event, idx) => {
    const listened = Number(event.percent_listened) || 0;
    const skipped = Boolean(event.manual_skip || event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent);
    if (skipped) sessions.add(toSessionKey(event, idx));
  });
  return sessions.size;
}

function countDistinctPositiveSessions(events = []) {
  const sessions = new Set();
  (events || []).forEach((event, idx) => {
    const listened = Number(event.percent_listened) || 0;
    const positive = Boolean(event.completed_play || listened >= 90 || Number(event.replayed_same_session) > 0);
    if (positive) sessions.add(toSessionKey(event, idx));
  });
  return sessions.size;
}

function ingestTrackForWorld(track = {}) {
  const safeTrack = normalizeTrack(track);
  if (isFavoriteTrack(safeTrack)) {
    return {
      ...safeTrack,
      globalOrbit: LISTENER_GLOBAL_FAVORITES_ORBIT,
      worldOrbit: null,
      inWorldAudition: false
    };
  }
  return {
    ...safeTrack,
    worldOrbit: WORLD_ORBITS.ORBIT_3,
    globalOrbit: null,
    inWorldAudition: true
  };
}

function evaluateTrackMovement(track, telemetry = [], policy = {}) {
  const nextPolicy = withPolicy(policy);
  if (isFavoriteTrack(track)) {
    const scoredFavorite = scoreTrackFromTelemetry(track, telemetry, nextPolicy);
    return {
      ...scoredFavorite,
      globalOrbit: LISTENER_GLOBAL_FAVORITES_ORBIT,
      worldOrbit: null,
      movement: "favorite_protected",
      archived: false,
      worldProblem: false
    };
  }

  const worldRecentEvents = Array.isArray(track.worldRecentEvents) ? track.worldRecentEvents : [];
  const spreeEvents = getWorldSkipSpreeEvents(worldRecentEvents, nextPolicy);
  const spreeKeys = new Set(spreeEvents.map((event) => `${event.timestamp || ""}__${toSessionKey(event)}`));
  const effectiveTelemetry = (telemetry || []).filter((event) => {
    const listened = Number(event.percent_listened) || 0;
    const skipped = Boolean(event.manual_skip || event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent);
    if (!skipped) return true;
    const key = `${event.timestamp || ""}__${toSessionKey(event)}`;
    return !spreeKeys.has(key);
  });
  const countSkipsAgainstTrack = effectiveTelemetry.some((event) => {
    const listened = Number(event.percent_listened) || 0;
    return Boolean(event.manual_skip || event.skipped_early || listened <= nextPolicy.earlySkipThresholdPercent);
  });
  const scored = scoreTrackFromTelemetry(track, effectiveTelemetry, nextPolicy);
  const previousOrbit = Object.values(WORLD_ORBITS).includes(scored.worldOrbit)
    ? scored.worldOrbit
    : WORLD_ORBITS.ORBIT_3;
  const preferredOrbit = resolveWorldOrbit(scored, nextPolicy);
  const skipSessionCount = countDistinctSkipSessions(effectiveTelemetry, nextPolicy);
  const positiveSessionCount = countDistinctPositiveSessions(effectiveTelemetry);

  let nextOrbit = previousOrbit;
  if (
    previousOrbit === WORLD_ORBITS.ORBIT_1 &&
    scored.rotationScore < nextPolicy.demotionScoreFloorOrbit1 &&
    skipSessionCount >= nextPolicy.minSkipSessionsForDemotion
  ) {
    nextOrbit = WORLD_ORBITS.ORBIT_2;
  } else if (
    previousOrbit === WORLD_ORBITS.ORBIT_2 &&
    scored.rotationScore < nextPolicy.demotionScoreFloorOrbit2 &&
    skipSessionCount >= nextPolicy.minSkipSessionsForDemotion
  ) {
    nextOrbit = WORLD_ORBITS.ORBIT_3;
  } else if (
    previousOrbit === WORLD_ORBITS.ORBIT_3 &&
    scored.rotationScore >= nextPolicy.promotionScoreFloorOrbit2 &&
    positiveSessionCount >= nextPolicy.minPositiveSessionsForPromotion
  ) {
    nextOrbit = WORLD_ORBITS.ORBIT_2;
  } else if (
    previousOrbit === WORLD_ORBITS.ORBIT_2 &&
    scored.rotationScore >= nextPolicy.promotionScoreFloorOrbit1 &&
    positiveSessionCount >= nextPolicy.minPositiveSessionsForPromotion
  ) {
    nextOrbit = WORLD_ORBITS.ORBIT_1;
  }

  const archived =
    nextOrbit === WORLD_ORBITS.ORBIT_3 &&
    skipSessionCount >= nextPolicy.moodSwitchSkipThreshold;
  let movement = "stable";
  if (archived) movement = "archive";
  else if (previousOrbit === WORLD_ORBITS.ORBIT_3 && nextOrbit === WORLD_ORBITS.ORBIT_2) movement = "promotion";
  else if (previousOrbit === WORLD_ORBITS.ORBIT_2 && nextOrbit === WORLD_ORBITS.ORBIT_1) movement = "promotion";
  else if (previousOrbit === WORLD_ORBITS.ORBIT_1 && nextOrbit === WORLD_ORBITS.ORBIT_2) movement = "demotion";
  else if (previousOrbit === WORLD_ORBITS.ORBIT_2 && nextOrbit === WORLD_ORBITS.ORBIT_3) movement = "demotion";

  return {
    ...scored,
    worldOrbit: nextOrbit,
    globalOrbit: null,
    movement,
    archived,
    worldProblem: spreeEvents.length > 0
  };
}

function shouldSwitchWorld({ recentEvents = [], policy = {} }) {
  return isWorldSkipSpree(recentEvents, policy);
}

function getArchivePath(archivedAtISO = new Date().toISOString()) {
  const date = new Date(archivedAtISO);
  if (Number.isNaN(date.getTime())) return null;
  const year = String(date.getUTCFullYear());
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const day = date.toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return { year, month, day };
}

function canReenterFromArchive(track, policy = {}) {
  const nextPolicy = withPolicy(policy);
  const attempts = Math.max(0, Number(track?.archiveRetestCount) || 0);
  return attempts < nextPolicy.archiveReentryMax;
}

function sharedTagsScore(current, candidate) {
  const currentTags = new Set([...(current.moodTags || []), current.genre].filter(Boolean));
  const candidateTags = new Set([...(candidate.moodTags || []), candidate.genre].filter(Boolean));
  let score = 0;
  for (const tag of currentTags) {
    if (candidateTags.has(tag)) score += 1;
  }
  return score;
}

function suggestNextAlbums({ currentAlbumId, albums = [], listenerSignals = {}, limit = 3 }) {
  const current = albums.find((album) => album.id === currentAlbumId);
  if (!current) return [];

  const entries = albums
    .filter((album) => album.id !== currentAlbumId)
    .map((album) => {
      const tagScore = sharedTagsScore(current, album);
      const behaviorScore = Number(listenerSignals[album.id] || 0);
      return {
        album,
        score: tagScore * 3 + behaviorScore
      };
    })
    .sort((a, b) => b.score - a.score || a.album.title.localeCompare(b.album.title));

  return entries.slice(0, limit).map((entry) => entry.album);
}

function selectOrbit3CandidatesFromOrbit1({
  orbit1Songs = [],
  candidateSongs = [],
  limit = 10
}) {
  const anchors = orbit1Songs.filter((song) => !isFavoriteTrack(song));
  const scored = (candidateSongs || []).map((candidate) => {
    const similarity = anchors.reduce((acc, anchor) => acc + sharedTagsScore(anchor, candidate), 0);
    return { candidate, similarity };
  });
  return scored
    .sort((a, b) => b.similarity - a.similarity || String(a.candidate.title || "").localeCompare(String(b.candidate.title || "")))
    .slice(0, limit)
    .map((entry) => ({
      ...ingestTrackForWorld(entry.candidate),
      similarityScoreToOrbit1: entry.similarity
    }));
}

function evaluateSessionSummary({
  tracks = [],
  events = [],
  policy = {}
}) {
  const nextPolicy = withPolicy(policy);
  const eventsByTrack = new Map();
  const worldEventsByWorld = new Map();
  for (const event of events || []) {
    if (!event || !event.trackId) continue;
    if (!eventsByTrack.has(event.trackId)) eventsByTrack.set(event.trackId, []);
    eventsByTrack.get(event.trackId).push(event);
    const world = event.world || "default_world";
    if (!worldEventsByWorld.has(world)) worldEventsByWorld.set(world, []);
    worldEventsByWorld.get(world).push(event);
  }

  const updates = [];
  const updatedTracks = (tracks || []).map((track) => {
    const trackEvents = eventsByTrack.get(track.id) || [];
    if (trackEvents.length === 0) return track;
    const world = track.world || trackEvents[0]?.world || "default_world";
    const worldRecentEvents = worldEventsByWorld.get(world) || [];
    const telemetry = trackEvents.map((event) => ({
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      percent_listened: Number(event.percentListened ?? event.percent_listened ?? 0),
      skipped_early: Boolean(event.skippedEarly ?? event.skipped_early),
      manual_skip: Boolean(event.manualSkip ?? event.manual_skip),
      completed_play: Boolean(event.completedPlay ?? event.completed_play),
      replayed_same_session: Number(event.replayedSameSession ?? event.replayed_same_session ?? 0)
    }));
    const movementResult = evaluateTrackMovement(
      { ...track, worldRecentEvents },
      telemetry,
      nextPolicy
    );
    const nextTrack = {
      ...track,
      worldOrbit: movementResult.worldOrbit,
      orbit:
        movementResult.worldOrbit === WORLD_ORBITS.ORBIT_1
          ? "rotation"
          : movementResult.worldOrbit === WORLD_ORBITS.ORBIT_2
            ? "recent"
            : "discovery",
      rotation: movementResult.worldOrbit === WORLD_ORBITS.ORBIT_1 || Boolean(track.rotationOverride === "force_on"),
      rotationScore: movementResult.rotationScore,
      archivedAt: movementResult.archived ? new Date().toISOString() : track.archivedAt || null
    };
    updates.push({
      trackId: track.id,
      movement: movementResult.movement,
      worldProblem: movementResult.worldProblem,
      archived: movementResult.archived
    });
    return nextTrack;
  });

  const worldSuggestions = Array.from(worldEventsByWorld.entries()).map(([world, worldEvents]) => ({
    world,
    shouldSwitchWorld: shouldSwitchWorld({ recentEvents: worldEvents, policy: nextPolicy })
  }));

  return { tracks: updatedTracks, updates, worldSuggestions };
}

module.exports = {
  DEFAULT_POLICY,
  LISTENER_GLOBAL_FAVORITES_ORBIT,
  withPolicy,
  isFavoriteTrack,
  ingestTrackForWorld,
  scoreTrackFromTelemetry,
  buildOrbitPools,
  pickNextTrack,
  resolveWorldOrbit,
  evaluateTrackMovement,
  countDistinctSkipSessions,
  countDistinctPositiveSessions,
  countConsecutiveSkips,
  isWorldSkipSpree,
  shouldCountSkipsAgainstTrack,
  getWorldSkipSpreeEvents,
  shouldSwitchWorld,
  getArchivePath,
  canReenterFromArchive,
  selectOrbit3CandidatesFromOrbit1,
  evaluateSessionSummary,
  suggestNextAlbums
};
