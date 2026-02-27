# Persistence Plan

Status: [DEFINED]

## Canonical Schema
- Source of truth: `docs/HANDOFF/BACKEND/DB_SCHEMA_V1.sql`
- Supabase migration copy: `apps/hound-listener/supabase/migrations/20260224_000001_backend_v1.sql`

## Runtime API
- Edge function: `apps/hound-listener/supabase/functions/api-v1/index.ts`
- Function config: `apps/hound-listener/supabase/config.toml`
- Existing gate functions remain:
  - `functions/redeem`
  - `functions/checkin`
- Dedicated worker service:
  - `apps/hound-worker/src/index.mjs`
  - Docker image entry: `apps/hound-worker/Dockerfile`

## Deployment Sequence
1) Apply schema migration to Supabase/Postgres.
2) Deploy edge function `api-v1`.
   - `config.toml` sets `verify_jwt = false` at gateway level for `api-v1`; endpoint-level bearer checks are enforced in code.
3) Configure env vars:
   - `EDGE_SUPABASE_URL`
   - `EDGE_SERVICE_ROLE_KEY`
   - `STORAGE_BUCKET_MASTERS`
   - `STORAGE_BUCKET_COVERS`
   - `STORAGE_BUCKET_STREAMS`
4) Start worker container/process:
   - `npm run worker:start`
   - Worker requires ffmpeg + ffprobe in runtime image.
4) Smoke test endpoints:
   - `POST /v1/auth/artist/signup`
   - `POST /v1/auth/listener/signup`
   - `POST /v1/auth/artist/login`
   - `POST /v1/auth/listener/login`
   - `POST /v1/auth/refresh`
   - `GET /v1/auth/me`
   - `POST /v1/auth/logout`
   - `GET/PUT /v1/studio/profile` (requires Bearer token)
   - `GET /v1/studio/releases` (requires Bearer token)
   - `POST /v1/studio/releases` (requires Bearer token)
   - `POST /v1/studio/releases/{releaseId}/uploads/master-intent`
   - `POST /v1/studio/releases/{releaseId}/uploads/cover-intent`
   - `POST /v1/studio/uploads/{assetId}/complete`
   - `POST /v1/studio/releases/{releaseId}/submit`
   - `POST /v1/studio/releases/{releaseId}/publish`
   - `GET /v1/listener/home`
   - `GET /v1/listener/albums/{albumId}`
   - `GET /v1/listener/tracks/{trackId}/stream`
   - `POST /v1/listener/telemetry/plays` (requires Bearer token)
   - `POST /v1/listener/telemetry/events` (requires Bearer token)
   - `POST /v1/listener/tracks/{trackId}/save` (requires Bearer token)
   - `GET /v1/listener/albums/{albumId}/suggested-next`

## Notes
- Protected endpoints now resolve identity from Supabase JWT Bearer tokens.
- Listener local SQLite remains valid for client-side cache/runtime behavior; remote truth is the Postgres schema above.
