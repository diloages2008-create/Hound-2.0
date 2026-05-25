export const LISTENER_GLOBAL_FAVORITES_ORBIT = "listener_orbit_1";

const WORLD_ORBITS = {
  ORBIT_1: "orbit_1",
  ORBIT_2: "orbit_2",
  ORBIT_3: "orbit_3"
};

const POLICY = {
  earlySkipThresholdPercent: 25,
  promotionScoreFloorOrbit2: 45,
  promotionScoreFloorOrbit1: 70,
  demotionScoreFloorOrbit1: 60,
  demotionScoreFloorOrbit2: 35,
  moodSwitchSkipThreshold: 4,
  consecutiveWorldSkipThreshold: 3,
  minPositiveSessionsForPromotion: 2,
  minSkipSessionsForDemotion: 2
};

function isFavoriteTrack(track = {}) {
  return Boolean(track.saved || track.isFavorite);
}

export function ingestTrackForWorld(track = {}) {
  if (isFavoriteTrack(track)) {
    return { ...track, globalOrbit: LISTENER_GLOBAL_FAVORITES_ORBIT, worldOrbit: null };
  }
  return { ...track, worldOrbit: WORLD_ORBITS.ORBIT_3, globalOrbit: null };
}

function toSessionKey(event, idx = 0) {
  if (event?.sessionId) return String(event.sessionId);
  if (event?.timestamp) {
    const d = new Date(event.timestamp);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return `unknown_${idx}`;
}

function countDistinctSkipSessions(events = []) {
  const sessions = new Set();
  events.forEach((event, idx) => {
    const listened = Number(event.percent_listened ?? event.percentListened ?? 0);
    const skipped = Boolean(
      (event.manual_skip ?? event.manualSkip) ||
      (event.skipped_early ?? event.skippedEarly) ||
      listened <= POLICY.earlySkipThresholdPercent
    );
    if (skipped) sessions.add(toSessionKey(event, idx));
  });
  return sessions.size;
}

function countDistinctPositiveSessions(events = []) {
  const sessions = new Set();
  events.forEach((event, idx) => {
    const listened = Number(event.percent_listened ?? event.percentListened ?? 0);
    const positive = Boolean(
      (event.completed_play ?? event.completedPlay) ||
      listened >= 90 ||
      Number(event.replayed_same_session ?? event.replayedSameSession ?? 0) > 0
    );
    if (positive) sessions.add(toSessionKey(event, idx));
  });
  return sessions.size;
}

function countConsecutiveSkips(events = []) {
  const ordered = [...events].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const event = ordered[i];
    const listened = Number(event.percent_listened ?? event.percentListened ?? 0);
    const skipped = Boolean(
      (event.manual_skip ?? event.manualSkip) ||
      (event.skipped_early ?? event.skippedEarly) ||
      listened <= POLICY.earlySkipThresholdPercent
    );
    if (!skipped) break;
    streak += 1;
  }
  return streak;
}

function shouldSwitchWorld(events = []) {
  return countConsecutiveSkips(events) >= POLICY.consecutiveWorldSkipThreshold;
}

function getWorldSkipSpreeEvents(events = []) {
  const ordered = [...events].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const spree = [];
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const event = ordered[i];
    const listened = Number(event.percent_listened ?? event.percentListened ?? 0);
    const skipped = Boolean(
      (event.manual_skip ?? event.manualSkip) ||
      (event.skipped_early ?? event.skippedEarly) ||
      listened <= POLICY.earlySkipThresholdPercent
    );
    if (!skipped) break;
    spree.push(event);
  }
  if (spree.length < POLICY.consecutiveWorldSkipThreshold) return [];
  return spree;
}

function computeScore(track, telemetry = []) {
  let score = Number(track.rotationScore || 0);
  for (const event of telemetry) {
    const listened = Number(event.percent_listened ?? 0);
    if (event.completed_play || listened >= 90) score += 12;
    if (Number(event.replayed_same_session || 0) > 0) score += 8;
    if (event.skipped_early || listened <= POLICY.earlySkipThresholdPercent) score -= 16;
  }
  if (track.saved) score += 10;
  if (track.rotationOverride === "force_on") score = Math.max(score, 65);
  if (track.rotationOverride === "force_off") score = 0;
  return Math.max(0, Math.min(100, score));
}

function evaluateTrackMovement(track, telemetry = [], worldRecentEvents = []) {
  if (isFavoriteTrack(track)) {
    return { ...track, movement: "favorite_protected", archived: false, worldProblem: false, worldOrbit: null };
  }
  const spreeEvents = getWorldSkipSpreeEvents(worldRecentEvents);
  const spreeKeys = new Set(spreeEvents.map((event) => `${event.timestamp || ""}__${toSessionKey(event)}`));
  const effectiveTelemetry = telemetry.filter((event) => {
    const listened = Number(event.percent_listened ?? event.percentListened ?? 0);
    const skipped = Boolean(
      (event.manual_skip ?? event.manualSkip) ||
      (event.skipped_early ?? event.skippedEarly) ||
      listened <= POLICY.earlySkipThresholdPercent
    );
    if (!skipped) return true;
    const key = `${event.timestamp || ""}__${toSessionKey(event)}`;
    return !spreeKeys.has(key);
  });
  const worldProblem = spreeEvents.length > 0;
  const score = computeScore(track, effectiveTelemetry);
  const skipSessions = countDistinctSkipSessions(effectiveTelemetry);
  const positiveSessions = countDistinctPositiveSessions(effectiveTelemetry);
  const previousOrbit = track.worldOrbit || WORLD_ORBITS.ORBIT_3;
  let nextOrbit = previousOrbit;

  if (previousOrbit === WORLD_ORBITS.ORBIT_1 && score < POLICY.demotionScoreFloorOrbit1 && skipSessions >= POLICY.minSkipSessionsForDemotion) nextOrbit = WORLD_ORBITS.ORBIT_2;
  else if (previousOrbit === WORLD_ORBITS.ORBIT_2 && score < POLICY.demotionScoreFloorOrbit2 && skipSessions >= POLICY.minSkipSessionsForDemotion) nextOrbit = WORLD_ORBITS.ORBIT_3;
  else if (previousOrbit === WORLD_ORBITS.ORBIT_3 && score >= POLICY.promotionScoreFloorOrbit2 && positiveSessions >= POLICY.minPositiveSessionsForPromotion) nextOrbit = WORLD_ORBITS.ORBIT_2;
  else if (previousOrbit === WORLD_ORBITS.ORBIT_2 && score >= POLICY.promotionScoreFloorOrbit1 && positiveSessions >= POLICY.minPositiveSessionsForPromotion) nextOrbit = WORLD_ORBITS.ORBIT_1;

  const archived = nextOrbit === WORLD_ORBITS.ORBIT_3 && skipSessions >= POLICY.moodSwitchSkipThreshold;
  return {
    ...track,
    rotationScore: score,
    worldOrbit: nextOrbit,
    movement:
      archived ? "archive"
      : previousOrbit !== nextOrbit && nextOrbit === WORLD_ORBITS.ORBIT_1 ? "promotion"
      : previousOrbit !== nextOrbit && nextOrbit === WORLD_ORBITS.ORBIT_2 && previousOrbit === WORLD_ORBITS.ORBIT_3 ? "promotion"
      : previousOrbit !== nextOrbit ? "demotion" : "stable",
    archived,
    worldProblem
  };
}

export function evaluateSessionSummary({ tracks = [], events = [] }) {
  const eventsByTrack = new Map();
  const worldEventsByWorld = new Map();
  for (const event of events) {
    if (!event?.trackId) continue;
    if (!eventsByTrack.has(event.trackId)) eventsByTrack.set(event.trackId, []);
    eventsByTrack.get(event.trackId).push(event);
    const world = event.world || "Normal";
    if (!worldEventsByWorld.has(world)) worldEventsByWorld.set(world, []);
    worldEventsByWorld.get(world).push(event);
  }

  const updates = [];
  const nextTracks = tracks.map((track) => {
    const trackEvents = eventsByTrack.get(track.id) || [];
    if (!trackEvents.length) return track;
    const telemetry = trackEvents.map((event) => ({
      session_id: event.sessionId,
      timestamp: event.timestamp,
      percent_listened: Number(event.percentListened ?? 0),
      skipped_early: Boolean(event.skippedEarly),
      manual_skip: Boolean(event.manualSkip),
      completed_play: Boolean(event.completedPlay),
      replayed_same_session: Number(event.replayedSameSession ?? 0)
    }));
    const world = track.world || trackEvents[0]?.world || "Normal";
    const result = evaluateTrackMovement(track, telemetry, worldEventsByWorld.get(world) || []);
    const nextTrack = {
      ...track,
      rotationScore: result.rotationScore,
      worldOrbit: result.worldOrbit,
      globalOrbit: track.saved ? LISTENER_GLOBAL_FAVORITES_ORBIT : null,
      orbit: track.saved ? null : (result.worldOrbit === WORLD_ORBITS.ORBIT_1 ? "rotation" : result.worldOrbit === WORLD_ORBITS.ORBIT_2 ? "recent" : "discovery"),
      rotation: result.worldOrbit === WORLD_ORBITS.ORBIT_1 || track.rotationOverride === "force_on",
      archivedAt: result.archived ? new Date().toISOString() : track.archivedAt || null
    };
    updates.push({ trackId: track.id, movement: result.movement, worldProblem: result.worldProblem, archived: result.archived });
    return nextTrack;
  });

  const worldSuggestions = Array.from(worldEventsByWorld.entries()).map(([world, worldEvents]) => ({
    world,
    shouldSwitchWorld: shouldSwitchWorld(worldEvents)
  }));

  return { tracks: nextTracks, updates, worldSuggestions };
}

const ORBIT_PRIORITY = {
  orbit_1: 0,
  orbit_2: 1,
  orbit_3: 2
};

function getOrbitPriority(track) {
  if (track?.globalOrbit === LISTENER_GLOBAL_FAVORITES_ORBIT) return -1;
  return ORBIT_PRIORITY[track?.worldOrbit] ?? 3;
}

export function selectNextRecommendedTrack({ tracks = [], currentTrackId = null, timeline = [] }) {
  const pool = (tracks || []).filter((track) => track && !track.archivedAt && track.id && track.id !== currentTrackId);
  if (!pool.length) return null;

  const recentIds = new Set((timeline || []).slice(-8));
  const notRecent = pool.filter((track) => !recentIds.has(track.id));
  const candidates = notRecent.length ? notRecent : pool;

  const sorted = [...candidates].sort((a, b) => {
    const orbitDelta = getOrbitPriority(a) - getOrbitPriority(b);
    if (orbitDelta !== 0) return orbitDelta;

    const scoreDelta = Number(b.rotationScore || 0) - Number(a.rotationScore || 0);
    if (scoreDelta !== 0) return scoreDelta;

    return String(a.id).localeCompare(String(b.id));
  });

  return sorted[0] || null;
}
