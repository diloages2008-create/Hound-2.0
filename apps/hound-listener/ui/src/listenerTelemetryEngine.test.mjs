import test from "node:test";
import assert from "node:assert/strict";
import {
  RAW_SONG_EVENT_NAMES,
  buildRawSongEvent,
  rawSongEventsToLearningSignals
} from "./listenerTelemetryEngine.js";

test("raw telemetry event names are fixed and complete", () => {
  assert.deepEqual(RAW_SONG_EVENT_NAMES, [
    "track_started",
    "track_skipped",
    "track_finished",
    "track_replayed",
    "favorite_toggled",
    "archive_restored",
    "next_track_selected"
  ]);
});

test("buildRawSongEvent builds schema envelope", () => {
  const event = buildRawSongEvent({
    eventName: "track_finished",
    track: { id: "t1" },
    sessionId: "s1",
    payload: { percent_listened: 100 }
  });
  assert.equal(event.event_name, "track_finished");
  assert.equal(event.track_id, "t1");
  assert.equal(event.session_id, "s1");
  assert.equal(event.schema_version, 1);
});

test("rawSongEventsToLearningSignals maps skip/finish/replay signals", () => {
  const raw = [
    {
      event_id: "a",
      event_name: "track_skipped",
      ts: "2026-01-01T00:00:00.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { percent_listened: 10, manual_skip: true, skipped_early: true },
      schema_version: 1
    },
    {
      event_id: "b",
      event_name: "track_finished",
      ts: "2026-01-01T00:03:00.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { percent_listened: 100, completed_play: true },
      schema_version: 1
    },
    {
      event_id: "c",
      event_name: "track_replayed",
      ts: "2026-01-01T00:04:00.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { replayed_same_session: 1, percent_listened: 70 },
      schema_version: 1
    }
  ];

  const mapped = rawSongEventsToLearningSignals(raw);
  assert.equal(mapped.length, 3);
  assert.equal(mapped[0].manualSkip, true);
  assert.equal(mapped[0].skippedEarly, true);
  assert.equal(mapped[1].completedPlay, true);
  assert.equal(mapped[2].replayedSameSession, 1);
});

test("rawSongEventsToLearningSignals ignores non-learning telemetry events", () => {
  const raw = [
    {
      event_id: "s",
      event_name: "track_started",
      ts: "2026-01-01T00:00:00.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { percent_listened: 0 },
      schema_version: 1
    },
    {
      event_id: "f",
      event_name: "favorite_toggled",
      ts: "2026-01-01T00:00:01.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { is_favorite: true },
      schema_version: 1
    },
    {
      event_id: "a",
      event_name: "archive_restored",
      ts: "2026-01-01T00:00:02.000Z",
      session_id: "s1",
      track_id: "t1",
      payload: { restored: true },
      schema_version: 1
    },
    {
      event_id: "n",
      event_name: "next_track_selected",
      ts: "2026-01-01T00:00:03.000Z",
      session_id: "s1",
      track_id: "t2",
      payload: { reason: "manual_next_end_of_timeline" },
      schema_version: 1
    }
  ];

  const mapped = rawSongEventsToLearningSignals(raw);
  assert.equal(mapped.length, 0);
});
