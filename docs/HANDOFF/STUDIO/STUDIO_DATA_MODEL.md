# Hound Studio Data Model

Status: [DEFINED]

Canonical source:
- `docs/HANDOFF/BACKEND/DB_SCHEMA_V1.sql`

Studio-critical tables:
- `artist_profiles`
- `artist_rights_attestations`
- `releases`
- `tracks`
- `track_credits`
- `upload_assets`
- `transcode_jobs`

Notes:
- Studio onboarding and upload flow should be driven from these tables.
- Release status transitions (`draft` -> `submitted` -> `in_transcode` -> `live`) are authoritative.
