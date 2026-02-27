# Listener Data Model

Status: [DEFINED]

Canonical source:
- `docs/HANDOFF/BACKEND/DB_SCHEMA_V1.sql`

Listener-critical tables:
- `app_users` (listener role)
- `releases`, `tracks`, `track_credits`
- `listener_play_events`
- `album_similarity_edges`

Notes:
- Local desktop SQLite remains useful as cache/runtime state, but remote truth should follow the v1 Postgres schema.
- Field names in telemetry payloads should map directly to `listener_play_events`.
