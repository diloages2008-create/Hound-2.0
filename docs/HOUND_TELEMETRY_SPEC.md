# Hound Local Listener Telemetry Spec

Status: Draft v1  
Scope: Local-first listener telemetry only (in-memory, no network export)  
Applies to: `apps/hound-listener/ui`

## 1) Raw Event Schema

All raw events MUST use this top-level schema:

```json
{
  "event_id": "string",
  "event_name": "string",
  "ts": "ISO-8601 string",
  "session_id": "string",
  "track_id": "string|null",
  "payload": {},
  "schema_version": 1
}
```

Field requirements:
- `event_id`: required, non-empty string, unique per event instance.
- `event_name`: required, must be one of allowed event names.
- `ts`: required, ISO timestamp in UTC.
- `session_id`: required, non-empty string (ephemeral/session-scoped).
- `track_id`: required key, may be `null` only when no track context exists.
- `payload`: required object, event-specific keys only.
- `schema_version`: required integer, current value `1`.

Top-level enforcement:
- Unknown top-level fields MUST be stripped or rejected consistently by implementation.
- Nested unknown payload fields MAY be dropped by event validators.

## 2) Allowed Raw Event Names

Only these raw event names are valid:

- `track_started`
- `track_skipped`
- `track_finished`
- `track_replayed`
- `favorite_toggled`
- `archive_restored`
- `next_track_selected`

## 3) Payload Fields Per Event Type

### `track_started`

Required:
- `source`: `"manual" | "history" | "recommendation" | "autoplay"`

Optional:
- `position_sec`: number (default `0`)
- `timeline_index`: integer
- `was_paused_before`: boolean

### `track_skipped`

Required:
- `skip_reason`: `"next_button" | "seek_past_end" | "other"`
- `position_sec`: number
- `track_duration_sec`: number

Optional:
- `percent_listened`: number (0-100)
- `source`: `"manual" | "autoplay"`

### `track_finished`

Required:
- `position_sec`: number
- `track_duration_sec`: number
- `percent_listened`: number (0-100)

Optional:
- `auto_advanced`: boolean

### `track_replayed`

Required:
- `replay_count_in_session`: integer (>= 1)

Optional:
- `from_position_sec`: number
- `to_position_sec`: number

### `favorite_toggled`

Required:
- `is_favorite`: boolean

Optional:
- `toggle_source`: `"now_playing" | "library" | "search" | "other"`

### `archive_restored`

Required:
- `restored`: boolean (must be `true` for this event)

Optional:
- `restore_source`: `"archive_view" | "other"`

### `next_track_selected`

Required:
- `selected_track_id`: string
- `selection_reason`: string

Optional:
- `reason_category`: `"queue" | "orbit_rotation" | "orbit_recent" | "orbit_discovery" | "fallback" | "empty"`
- `candidate_count`: integer
- `excluded_recent_count`: integer

Notes:
- `selection_reason` should capture engine-return reason when available (for example `orbit:rotation`, `queue`, `empty`).

## 4) Privacy Rules

Hard rules (MUST NOT store):
- PII (email, name, phone, auth tokens, IP).
- File paths (absolute or relative local paths).
- GPS/location coordinates or inferred location labels.
- Device fingerprints or persistent machine identifiers.

Operational rules:
- No network sending/export in this phase.
- Telemetry remains local and in-memory only.
- Session IDs must be ephemeral and non-identifying.
- Debug logs must never print sensitive payload content.

## 5) Local Buffer Behavior

Buffer defaults:
- In-memory only.
- Max raw events: `1000` (ring buffer behavior recommended).

Required interface:
- `record(event)`: validate/normalize; append if valid.
- `listRawEvents()`: return shallow copy in insertion order.
- `clearRawEvents()`: remove all buffered events.

Buffer constraints:
- When max size is reached, evict oldest first.
- Validation failures should not mutate buffer.
- Derived analytics are NOT stored as raw events.

## 6) Derived Signal Contract

Derived signals are computed from raw events separately from storage.

Per-track/session derived fields:
- `completion_percentage`: number (0-100)
- `early_skip`: boolean  
  Rule: true when skip occurs before configured threshold (default 25%).
- `positive_listen`: boolean  
  Rule: true when finished or listened above positive threshold (default 90%).
- `negative_listen`: boolean  
  Rule: true when early skip or repeated short listens.
- `replay_count`: integer
- `skip_count`: integer
- `finish_rate`: number (finished_plays / started_plays)
- `next_track_selection_reason`: string (latest or distribution by reason)

Determinism rule:
- Given identical ordered raw event input, derived output must be identical.

## 7) Debug Behavior

Debug toggle:
- Enabled only when `VITE_HOUND_TELEMETRY_DEBUG === "true"`.

Logging requirements:
- Log short summaries only.
- Preferred format: one line per event, e.g.  
  `TELEMETRY track_skipped track=t123 pct=18 reason=next_button`
- Do not log full payload dumps by default.
- Never log blocked/sensitive fields.

## 8) Test Plan

Minimum tests:
- Valid event is accepted and stored.
- Invalid `event_name` is rejected.
- Unknown top-level fields are stripped or rejected (consistent behavior).
- Buffer cap works (oldest evicted after max reached).
- Derived signals are deterministic for identical input.
- No file paths or PII are stored in accepted events.

Additional recommended tests:
- `schema_version` mismatch handling.
- `track_id` null handling (allowed only in explicitly approved cases).
- `next_track_selected` reason mapping from selector output.

## Non-Goals (Current Phase)

- No remote telemetry transport.
- No analytics dashboard/export.
- No Studio/DEN/Electron telemetry changes.
- No dependency additions for analytics SDKs.

