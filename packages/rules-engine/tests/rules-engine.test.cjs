const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WORLD_ORBITS
} = require("@hound/domain-types");

const {
  LISTENER_GLOBAL_FAVORITES_ORBIT,
  ingestTrackForWorld,
  selectOrbit3CandidatesFromOrbit1,
  evaluateTrackMovement,
  shouldSwitchWorld,
  shouldCountSkipsAgainstTrack,
  canReenterFromArchive,
  countDistinctSkipSessions,
  evaluateSessionSummary
} = require("../index.cjs");

const baseTrack = {
  id: "t1",
  title: "Track 1",
  artist: "Artist",
  moodTags: ["night", "warm"],
  genre: "alt-soul",
  rotationScore: 50,
  playHistory: []
};

function skipEvent(sessionId, ts = "2026-05-21T10:00:00.000Z") {
  return {
    sessionId,
    timestamp: ts,
    percent_listened: 5,
    skipped_early: true,
    manual_skip: true,
    completed_play: false,
    replayed_same_session: 0
  };
}

function positiveEvent(sessionId, ts = "2026-05-21T10:00:00.000Z") {
  return {
    sessionId,
    timestamp: ts,
    percent_listened: 98,
    skipped_early: false,
    manual_skip: false,
    completed_play: true,
    replayed_same_session: 0
  };
}

test("Rule 1: all non-favorites enter world through Orbit 3 only", () => {
  const ingested = ingestTrackForWorld({ ...baseTrack, saved: false });
  assert.equal(ingested.worldOrbit, WORLD_ORBITS.ORBIT_3);
  assert.equal(ingested.globalOrbit, null);
});

test("Rule 2: Orbit 3 candidates are selected by similarity to Orbit 1 songs in the same world", () => {
  const orbit1Songs = [
    { id: "o1", title: "Anchor", genre: "alt-soul", moodTags: ["night", "warm"] }
  ];
  const candidates = [
    { id: "a", title: "A", genre: "alt-soul", moodTags: ["night"] },
    { id: "b", title: "B", genre: "metal", moodTags: ["heavy"] }
  ];
  const selected = selectOrbit3CandidatesFromOrbit1({ orbit1Songs, candidateSongs: candidates, limit: 1 });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "a");
  assert.equal(selected[0].worldOrbit, WORLD_ORBITS.ORBIT_3);
});

test("Rule 3: favorites enter global listener orbit, not world orbit", () => {
  const ingested = ingestTrackForWorld({ ...baseTrack, saved: true });
  assert.equal(ingested.globalOrbit, LISTENER_GLOBAL_FAVORITES_ORBIT);
  assert.equal(ingested.worldOrbit, null);
});

test("Rule 4: favorites cannot be demoted or archived from skips", () => {
  const result = evaluateTrackMovement(
    { ...baseTrack, saved: true, worldOrbit: WORLD_ORBITS.ORBIT_1 },
    [skipEvent("s1"), skipEvent("s2"), skipEvent("s3"), skipEvent("s4")]
  );
  assert.equal(result.movement, "favorite_protected");
  assert.equal(result.archived, false);
  assert.equal(result.globalOrbit, LISTENER_GLOBAL_FAVORITES_ORBIT);
});

test("Rule 5: non-favorites move inward only by holding attention across sessions", () => {
  const oneSession = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_3, rotationScore: 48, saved: false },
    [positiveEvent("session_one")]
  );
  assert.equal(oneSession.worldOrbit, WORLD_ORBITS.ORBIT_3);

  const twoSessions = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_3, rotationScore: 48, saved: false },
    [positiveEvent("session_one"), positiveEvent("session_two")]
  );
  assert.equal(twoSessions.worldOrbit, WORLD_ORBITS.ORBIT_2);
});

test("Rule 6: non-favorites move outward only from repeated skips across different sessions", () => {
  const sameSession = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_1, rotationScore: 62, saved: false },
    [skipEvent("same"), skipEvent("same")]
  );
  assert.equal(countDistinctSkipSessions([skipEvent("same"), skipEvent("same")]), 1);
  assert.equal(sameSession.worldOrbit, WORLD_ORBITS.ORBIT_1);

  const differentSessions = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_1, rotationScore: 62, saved: false },
    [skipEvent("s1"), skipEvent("s2")]
  );
  assert.equal(differentSessions.worldOrbit, WORLD_ORBITS.ORBIT_2);
});

test("Rule 7: consecutive skip sprees trigger world-level rejection, not song punishment", () => {
  const worldRecentEvents = [skipEvent("w1", "2026-05-21T10:01:00.000Z"), skipEvent("w1", "2026-05-21T10:02:00.000Z"), skipEvent("w1", "2026-05-21T10:03:00.000Z")];
  const result = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_2, worldRecentEvents, rotationScore: 55, saved: false },
    [skipEvent("s1")]
  );
  assert.equal(result.worldProblem, true);
});

test("Rule 8: after skip-spree threshold, ignore skip inputs for song demotion", () => {
  const spree1 = skipEvent("s1", "2026-05-21T10:01:00.000Z");
  const spree2 = skipEvent("s2", "2026-05-21T10:02:00.000Z");
  const spree3 = skipEvent("s3", "2026-05-21T10:03:00.000Z");
  const worldRecentEvents = [spree1, spree2, spree3];
  assert.equal(shouldCountSkipsAgainstTrack({ worldRecentEvents }), false);
  const result = evaluateTrackMovement(
    { ...baseTrack, worldOrbit: WORLD_ORBITS.ORBIT_2, worldRecentEvents, rotationScore: 55, saved: false },
    [spree1, spree2, spree3]
  );
  assert.notEqual(result.movement, "demotion");
  assert.equal(result.rotationScore, 55);
});

test("Rule 9: archived songs may re-enter Orbit 3 only limited number of times", () => {
  assert.equal(canReenterFromArchive({ archiveRetestCount: 0 }, { archiveReentryMax: 3 }), true);
  assert.equal(canReenterFromArchive({ archiveRetestCount: 2 }, { archiveReentryMax: 3 }), true);
  assert.equal(canReenterFromArchive({ archiveRetestCount: 3 }, { archiveReentryMax: 3 }), false);
});

test("Rule 10: goal is reducing skipping, not rewarding endless skipping", () => {
  const events = [skipEvent("a", "2026-05-21T10:01:00.000Z"), skipEvent("b", "2026-05-21T10:02:00.000Z"), skipEvent("c", "2026-05-21T10:03:00.000Z")];
  assert.equal(shouldSwitchWorld({ recentEvents: events }), true);
});

test("session summary triggers promotion/demotion and world switch suggestion", () => {
  const tracks = [
    { ...baseTrack, id: "promote-me", world: "Night Drive", worldOrbit: "orbit_3", saved: false, rotationScore: 50 },
    { ...baseTrack, id: "demote-me", world: "Night Drive", worldOrbit: "orbit_1", saved: false, rotationScore: 60 }
  ];
  const events = [
    { trackId: "promote-me", world: "Night Drive", ...positiveEvent("s1", "2026-05-21T10:00:00.000Z"), percentListened: 96 },
    { trackId: "promote-me", world: "Night Drive", ...positiveEvent("s2", "2026-05-22T10:00:00.000Z"), percentListened: 97 },
    { trackId: "demote-me", world: "Night Drive", ...skipEvent("s3", "2026-05-23T10:00:00.000Z"), percentListened: 5, manualSkip: true, skippedEarly: true },
    { trackId: "demote-me", world: "Night Drive", ...skipEvent("s4", "2026-05-24T10:00:00.000Z"), percentListened: 6, manualSkip: true, skippedEarly: true }
  ];
  const result = evaluateSessionSummary({ tracks, events });
  const promoted = result.tracks.find((t) => t.id === "promote-me");
  const demoted = result.tracks.find((t) => t.id === "demote-me");
  assert.equal(promoted.worldOrbit, "orbit_2");
  assert.equal(demoted.worldOrbit, "orbit_2");
  const worldSignal = result.worldSuggestions.find((w) => w.world === "Night Drive");
  assert.equal(worldSignal.shouldSwitchWorld, false);
});
