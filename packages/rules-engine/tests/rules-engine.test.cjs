const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scoreTrackFromTelemetry,
  buildOrbitPools,
  pickNextTrack,
  suggestNextAlbums
} = require("../index.cjs");

const baseTrack = {
  id: "t1",
  title: "Track 1",
  artist: "Artist",
  moodTags: ["Warm"],
  genre: "Alt Soul",
  playHistory: []
};

test("scoreTrackFromTelemetry rewards completion and penalizes early skip", () => {
  const scored = scoreTrackFromTelemetry(
    { ...baseTrack, rotationScore: 40 },
    [
      { percent_listened: 100, completed_play: true, skipped_early: false, replayed_same_session: 1 },
      { percent_listened: 10, completed_play: false, skipped_early: true, replayed_same_session: 0 }
    ]
  );

  assert.equal(scored.rotationScore, 44);
  assert.equal(scored.rotation, false);
});

test("buildOrbitPools buckets tracks by rotation/recent/discovery", () => {
  const now = "2026-02-24T12:00:00.000Z";
  const pools = buildOrbitPools([
    { ...baseTrack, id: "r1", rotation: true, rotationScore: 80 },
    {
      ...baseTrack,
      id: "re1",
      playCountTotal: 2,
      lastPositiveListenAt: "2026-02-24T10:00:00.000Z"
    },
    { ...baseTrack, id: "d1", playCountTotal: 0, lastPositiveListenAt: null }
  ], now);

  assert.equal(pools.rotation.length, 1);
  assert.equal(pools.recent.length, 1);
  assert.equal(pools.discovery.length, 1);
});

test("pickNextTrack uses queue first then orbit priority", () => {
  const tracks = [
    { ...baseTrack, id: "a", title: "A", rotation: true, rotationScore: 70 },
    { ...baseTrack, id: "b", title: "B", playCountTotal: 1, lastPositiveListenAt: new Date().toISOString() }
  ];

  const queued = pickNextTrack({ tracks, queue: ["b"], currentTrackId: "a" });
  assert.equal(queued.reason, "queue");
  assert.equal(queued.track.id, "b");

  const fromOrbit = pickNextTrack({ tracks, queue: [], currentTrackId: "b" });
  assert.equal(fromOrbit.reason, "orbit:rotation");
  assert.equal(fromOrbit.track.id, "a");
});

test("suggestNextAlbums ranks by shared tags and listener behavior", () => {
  const albums = [
    { id: "cur", title: "Current", genre: "Alt Soul", moodTags: ["Warm", "Night"] },
    { id: "x", title: "X", genre: "Alt Soul", moodTags: ["Warm"] },
    { id: "y", title: "Y", genre: "Rock", moodTags: ["Road"] },
    { id: "z", title: "Z", genre: "Alt Soul", moodTags: ["Night", "Warm"] }
  ];

  const result = suggestNextAlbums({
    currentAlbumId: "cur",
    albums,
    listenerSignals: { x: 1, y: 9, z: 2 },
    limit: 2
  });

  assert.deepEqual(result.map((entry) => entry.id), ["z", "y"]);
});
