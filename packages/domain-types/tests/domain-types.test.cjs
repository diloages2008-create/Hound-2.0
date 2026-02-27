const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORBITS,
  ROTATION_OVERRIDE,
  normalizeTrack,
  validatePlayEvent,
  clamp,
  toISO
} = require("../index.cjs");

test("normalizeTrack enforces defaults and clamps numeric fields", () => {
  const track = normalizeTrack({
    id: "t1",
    rotationScore: 200,
    playCountTotal: -10,
    moodTags: ["Warm", "", null],
    rotationOverride: "invalid"
  });

  assert.equal(track.rotationScore, 100);
  assert.equal(track.playCountTotal, 0);
  assert.deepEqual(track.moodTags, ["Warm"]);
  assert.equal(track.rotationOverride, ROTATION_OVERRIDE.NONE);
});

test("normalizeTrack throws without valid id", () => {
  assert.throws(() => normalizeTrack({ title: "No ID" }), /Track requires a non-empty string id/);
});

test("validatePlayEvent requires all known telemetry keys", () => {
  const valid = {
    play_start_time: "2026-02-24T12:00:00.000Z",
    play_end_time: "2026-02-24T12:03:00.000Z",
    play_duration_seconds: 180,
    track_total_duration: 200,
    percent_listened: 90,
    skipped_early: false,
    replayed_same_session: 0,
    completed_play: false,
    manual_skip: false,
    auto_advance: true,
    timestamp: "2026-02-24T12:03:00.000Z"
  };

  assert.equal(validatePlayEvent(valid), true);
  assert.equal(validatePlayEvent({ ...valid, timestamp: undefined }), true);
  assert.equal(validatePlayEvent({}), false);
});

test("clamp and toISO helpers work as expected", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
  assert.match(toISO("2026-02-24"), /^2026-02-24T/);
  assert.equal(toISO("not-a-date"), null);
});

test("orbit constants are stable", () => {
  assert.equal(ORBITS.ROTATION, "rotation");
  assert.equal(ORBITS.RECENT, "recent");
  assert.equal(ORBITS.DISCOVERY, "discovery");
});
