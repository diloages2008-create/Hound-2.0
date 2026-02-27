const { ORBITS, ROTATION_OVERRIDE, normalizeTrack, clamp } = require("@hound/domain-types");

const DEFAULT_POLICY = Object.freeze({
  rotationScoreThreshold: 55,
  recentWindowHours: 72,
  maxRecentTracks: 50,
  earlySkipThresholdPercent: 25,
  replayBonus: 8,
  completionBonus: 12,
  earlySkipPenalty: 16,
  saveBonus: 10,
  forceOnScoreFloor: 65
});

function withPolicy(policy = {}) {
  return { ...DEFAULT_POLICY, ...policy };
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

module.exports = {
  DEFAULT_POLICY,
  withPolicy,
  scoreTrackFromTelemetry,
  buildOrbitPools,
  pickNextTrack,
  suggestNextAlbums
};
