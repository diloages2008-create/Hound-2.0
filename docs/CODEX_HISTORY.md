# Codex History

Last scan summary of the Hound monorepo. This is a living log to track what exists,
what is missing, and what to work on next.

Primary capability reference: `docs/CURRENT_CAPABILITIES.md` (merged on 2026-02-24).

## Snapshot (Repo Shape)
- Monorepo with `apps/` and `packages/` workspaces.
- `apps/hound-listener`: Electron + Vite + React desktop app.
- `apps/hound-studio`: React web app with artist workflow UI and shared shell navigation.
- `packages/domain-types` and `packages/rules-engine`: implemented shared logic packages.
- `docs/`: capability list, handoff specs (UI, backend, studio), acceptance tests.

## Features We Have (Implemented)

### Listener App (Desktop)
- Local file import using Electron file dialog; audio formats include mp3, wav, m4a, flac, aac, alac, ogg, opus.
- Playback controls: play/pause/prev/next, seek, stop, queue, mini-player.
- Loudness normalization and audio analysis pipeline (ffmpeg + worker).
- Crossfade support and audio lifecycle rules aligned to `AUDIO_CONTRACT.md`.
- Library UI with table layout, now playing view, search view, queue view, context menu.
- Rotation and orbit state tracking (rotation/recent/discovery), manual force on/off, long-term decay to drop ignored tracks.
- Playback telemetry captured per play, plus session history in UI.
- Optional dev HUD for orbit selection diagnostics.

Key files:
- UI: `apps/hound-listener/ui/src/App.jsx`
- Electron: `apps/hound-listener/electron/main.cjs`, `apps/hound-listener/electron/preload.cjs`
- Analysis worker: `apps/hound-listener/electron/analysis-worker.cjs`

### Listener App (Persistence + Analysis)
- SQLite database stored in `apps/hound-listener/data/hound.db`.
- Tables for tracks, prefs, orbits, playback events, embeddings, and metrics.
- IPC endpoints for library fetch, prefs updates, playback events, orbit updates,
  analysis queueing, and recommendation neighbors.

Key files:
- DB schema: `apps/hound-listener/electron/db.cjs`
- IPC handlers: `apps/hound-listener/electron/main.cjs`

### Studio App (Web)
- Artist-focused shell with dedicated sections for:
  - Dashboard (onboarding + signal analytics)
  - Upload (master/cover/metadata/credits/lyrics payload view + pipeline status)
  - Catalog library (album-first cards with visible credits and release state)
  - Profile (bio/influences/credits/socials + rights attestation)
- Responsive visual redesign with distinct studio brand styling and mobile-safe layouts.
- Shared local mock data source to keep artist workflow states coherent across pages.

Key files:
- App + shell: `apps/hound-studio/src/App.jsx`, `apps/hound-studio/src/components/StudioShell.jsx`
- Pages: `apps/hound-studio/src/pages/*.jsx`
- Data: `apps/hound-studio/src/data/studioData.js`
- Styling: `apps/hound-studio/src/styles.css`

### Access Gate (Supabase)
- Schema for invites/devices/sessions in `apps/hound-listener/supabase/schema.sql`.
- Edge functions: `checkin` and `redeem` for gate validation.

### Shared Packages (Core Logic)
- `@hound/domain-types` implemented with shared constants, track normalization,
  telemetry validation, and helper utilities.
- `@hound/rules-engine` implemented with policy-aware scoring, orbit pool building,
  queue/orbit next-track selection, and lightweight album suggestions.
- Added package-level tests for both shared packages and verified passing in workspace.

## What We Do Not Have (Gaps / Missing)
- Studio app is UI-complete for v1 workflow shape but still uses local mock data.
- Orbit/autoplay weighting is not fully implemented per `docs/HANDOFF/GAP_ANALYSIS.md`.
- No consolidated implementation brief (see `docs/HANDOFF/DEVELOPER_BRIEF.md`).
- No streaming or remote URL playback (local files only).
- Some specs in `docs/` are not reflected in code yet (needs alignment).

## What To Work On Next
1) Align docs and code: confirm which persistence model is authoritative and update
   `docs/CURRENT_CAPABILITIES.md` to match (including new long-term orbit decay).
2) Wire Studio pages to backend auth/storage/metadata APIs (current Studio uses mock data only).
3) Integrate shared rules packages into live listener runtime paths.
4) Finish orbit/autoplay weighting behavior against handoff acceptance criteria.
5) Decide on backend API contract and integrate with both Studio (artist flows) and Listener (catalog streams).

## Session Log (2026-02-24)
- Replaced `apps/hound-studio` placeholder pages with a complete artist-focused v1 UI:
  dashboard, upload flow, catalog, profile, shared shell navigation, and responsive redesign.
- Added Studio local shared data layer:
  `apps/hound-studio/src/data/studioData.js`.
- Merged and normalized capability documentation:
  `docs/CURRENT_CAPABILITIES.md` became primary capability source and `CODEX_HISTORY`
  now mirrors major milestones.
- Implemented shared packages:
  - `packages/domain-types` with contracts, normalization, constants, and telemetry validation.
  - `packages/rules-engine` with scoring, orbit pooling, next-track selection, and album suggestions.
- Added package tests:
  - `packages/domain-types/tests/domain-types.test.cjs`
  - `packages/rules-engine/tests/rules-engine.test.cjs`
- Added root scripts:
  - `domain:test`
  - `rules:test`
  - `packages:test`
- Optimized package transport/maintenance:
  refactored duplicated CJS/ESM implementations into single core files with thin wrappers.
  - `packages/domain-types/core.cjs` + wrapper entries.
  - `packages/rules-engine/core.cjs` + wrapper entries.
- Validation run results:
  - `npm run packages:test` passed.
  - `npm run studio:build` passed.
  - `npm run listener:build` passed.
- Added canonical backend specs:
  - `docs/HANDOFF/BACKEND/OPENAPI_V1.yaml` (v1 contract for Studio + Listener)
  - `docs/HANDOFF/BACKEND/DB_SCHEMA_V1.sql` (v1 Postgres/Supabase data model)
- Replaced placeholder handoff docs with references to canonical specs:
  - `docs/HANDOFF/BACKEND/API_CONTRACT.md`
  - `docs/HANDOFF/BACKEND/DATA_MODEL.md`
  - `docs/HANDOFF/STUDIO/STUDIO_API_CONTRACT.md`
  - `docs/HANDOFF/STUDIO/STUDIO_DATA_MODEL.md`
- Added runtime backend scaffolding in Supabase:
  - Migration file `apps/hound-listener/supabase/migrations/20260224_000001_backend_v1.sql`
  - Edge function `apps/hound-listener/supabase/functions/api-v1/index.ts`
- `api-v1` implements initial endpoints for:
  - artist signup
  - studio profile get/update
  - release creation
  - listener home
  - album detail
  - stream manifest resolution
  - telemetry ingest
  - suggested-next albums
- Added concrete persistence/deploy document:
  - `docs/HANDOFF/BACKEND/PERSISTENCE_PLAN.md`
- Advanced `api-v1` auth implementation:
  - Protected routes now require Supabase JWT Bearer tokens.
  - Added `POST /v1/auth/artist/login` for access token issuance.
  - Removed `x-user-id` bridge dependency for protected routes.
- Wired Studio UI to live backend endpoints:
  - `Profile` page now supports signup/login, profile load, and profile save via API.
  - `Upload` page now creates release drafts via API.
  - Added `apps/hound-studio/src/lib/apiClient.js` for API/token management.
- Wired Listener UI verification bridge to backend endpoints:
  - Cloud login from Home panel
  - Listener home rails fetch
  - Album detail fetch
  - Stream manifest resolution
  - Implemented in `apps/hound-listener/ui/src/App.jsx` as a non-breaking verification mode.
- Validation after wiring:
  - `npm run studio:build` passed.
  - `npm run listener:build` passed.
- Added Supabase function config:
  - `apps/hound-listener/supabase/config.toml`
  - Explicit `verify_jwt = false` for `api-v1`, `checkin`, and `redeem` to allow public entrypoints while app-level auth checks run in function code.
- Added backend-free verification mode in both apps:
  - Studio mock API adapter: `apps/hound-studio/src/lib/mockApi.js`
  - Listener mock cloud adapter: `apps/hound-listener/ui/src/mockCloudApi.js`
  - Env toggles: `apps/hound-studio/.env.example`, `apps/hound-listener/ui/.env.example`
  - API mode switch via `VITE_HOUND_API_MODE=mock` enables full local flow verification without deploying backend.
- Extended Studio backend integration:
  - Added `GET /v1/studio/releases` in `api-v1` and OpenAPI contract.
  - Wired Studio Dashboard and Library pages to live/mock release catalog reads.
- v0.1 loop hardening pass:
  - Added migration `20260227_000002_v01_hardening.sql` with:
    - `tracks.loudness_lufs`
    - idempotent `client_event_id` support for `listener_play_events`
    - `listener_event_log` table for milestone/skip/completion events
    - `listener_track_saves` table for cloud save sync
  - Expanded `api-v1` endpoints:
    - auth: `artist/listener signup`, `artist/listener login`, `refresh`, `me`, `logout`
    - studio pipeline: upload intents, upload completion, submit, publish
    - listener telemetry: idempotent play ingest + event log ingest
    - listener save sync: `POST /v1/listener/tracks/{trackId}/save`
  - Studio auth/session and route guard updates:
    - app boot identity check via `/v1/auth/me`
    - refresh-token path and logout support in `apiClient`
    - protected-route behavior in `apps/hound-studio/src/App.jsx`
  - Studio upload page now runs explicit v0.1 pipeline sequence:
    create release -> upload intents -> complete uploads -> submit -> publish
  - Listener cloud playback bridge upgraded:
    - listener login + role check (`/auth/me`)
    - refresh-token retry path for authenticated requests
    - remote track play + remote queue path in primary player
    - buffering state display and one-shot stream retry on error
    - cloud telemetry milestone + skip/completion emission
    - cloud save/unsave sync calls
- Transcode worker sprint (real infra path):
  - Added migration `20260227_000003_worker_spine.sql`:
    - `upload_assets.storage_bucket`
    - `transcode_jobs` locking/retry columns (`track_id`, `attempts`, `max_attempts`, `next_retry_at`, `locked_at`, `locked_by`, `started_at`, `completed_at`)
    - SQL function `claim_transcode_job(p_worker_id)` using `FOR UPDATE SKIP LOCKED`
  - Enforced ingestion behavior in `api-v1`:
    - submit no longer simulates completion
    - submit validates uploaded masters, queues real jobs, and advances release to `in_transcode`
    - publish now strictly checks manifest + duration + loudness + processed masters + completed jobs
  - Added dedicated worker service:
    - `apps/hound-worker/src/index.mjs`
    - `apps/hound-worker/package.json`
    - `apps/hound-worker/Dockerfile`
    - `apps/hound-worker/README.md`
  - Worker behavior:
    - claims queued jobs via SQL function
    - downloads master from storage
    - runs ffprobe/ffmpeg
    - uploads HLS manifest/segments to streams bucket
    - writes track duration/loudness/manifest path
    - marks source asset processed and job completed
    - retries with backoff, then fails permanently

## Session Log (2026-02-27, Navigation + Ops Runbooks)
- Added root navigation surface:
  - `README.md` with top-level map and command entry points.
  - `docs/INDEX.md` as doc navigation root.
- Added operations runbooks and scripts:
  - `ops/README.md`
  - `ops/deploy-v01.ps1` (link, db push, secrets set, function deploy)
  - `ops/verify-first-release.ps1` (auth -> create release -> upload -> submit -> publish poll -> listener stream -> telemetry)
- Added root npm script shortcuts:
  - `ops:deploy:v01`
  - `ops:verify:first-release`
- Normalized app navigation docs:
  - updated `apps/hound-listener/README.md`
  - added `apps/hound-studio/README.md`
- Cleaned ignore rules:
  - deduplicated `.gitignore` entries and added local env variants.
- Validation run results:
  - PowerShell syntax check for both `ops/*.ps1` scripts passed.
  - `npm run packages:test` passed.
  - `npm run studio:build` passed.
- Local environment blockers discovered for live deployment/first real job execution:
  - `supabase` CLI is not installed in this environment.
  - `ffmpeg` is not installed in this environment.
  - `docker` is not installed in this environment.

## Session Log (2026-02-27, Live Flip Attempt)
- Tooling status:
  - `ffmpeg` is installed (winget package exists).
  - local Supabase CLI binary was added at `.tools/supabase/supabase.exe`.
- Infrastructure actions attempted:
  - Confirmed `api-v1` endpoint is reachable at `.../functions/v1/api-v1`.
  - Created/confirmed buckets via storage API: `hound-masters`, `hound-covers`, `hound-streams`.
  - Attempted to run real worker + first-release verifier end-to-end.
- Hard blockers found in live project:
  - Function gateway rejects current key for public auth endpoints with `{"error":"Invalid API key"}`.
  - Worker reports schema cache misses for ingestion objects (`transcode_jobs` table / `claim_transcode_job` function), indicating live DB migrations are not fully applied or not exposed.
- Code hardening added during attempt:
  - `ops/verify-first-release.ps1` now supports `-ApiKey` and sends `apikey` header.
  - `apps/hound-worker/src/index.mjs` now includes fallback job-claim logic when SQL claim RPC is missing.

## Session Log (2026-02-27, End-to-End Loop Verified)
- Fixed migration compatibility and ordering issues:
  - Updated `20260224_000001_backend_v1.sql` to use valid idempotent FK constraint creation.
  - Renamed worker spine migration to unique version: `20260228_000003_worker_spine.sql`.
  - Added telemetry conflict fix migration: `20260301_000004_telemetry_conflict_fix.sql`.
- Applied remote migrations successfully with Supabase CLI.
- Deployed `api-v1` successfully.
- Executed real worker + real upload + real submit + real publish + listener stream + telemetry ingest.
- Verified successful run output:
  - `releaseId`: `ed871924-b61f-4543-83dd-3032cb86995a`
  - `trackId`: `7415f9b8-0ab1-47fb-958d-ec289f4b8db9`
  - `manifest`: `https://cdn.hound.fm/manifests/7415f9b8-0ab1-47fb-958d-ec289f4b8db9/index.m3u8`
  - `eventId`: `4c6c6bd2-5119-47f2-aae1-c937c27bc38b`

## Session Log (2026-02-27, Major Milestone Backup + Web-First Freeze)
- Created milestone backup archive:
  - `backups/hound-major-milestone-20260227-020509.tar.gz`
- Switched repository scripts to web-first mode:
  - Root `listener:dev` now points to web mode.
  - Root `listener:pack` and `listener:dist` are explicitly disabled.
  - Listener app scripts `dev:app`, `electron`, `pack`, `dist` are explicitly disabled.
  - Listener `start` now runs `dev:web`.
- Updated navigation/readme docs to reflect web-first freeze and deferred desktop packaging.

## Session Log (2026-02-27, v0.2 Operator Readiness Docs)
- Added founder/operator stability definition:
  - `docs/DEFINITION_OF_STABLE_V02.md`
- Added sign-off checklist for beta gate validation:
  - `docs/V02_VERIFICATION_CHECKLIST.md`
- Added minimum operator dashboard specification:
  - `docs/V02_OPERATOR_DASHBOARD_SPEC.md`
- Added 72-hour failure simulation drill plan with evidence table:
  - `docs/V02_72_HOUR_DRILL_PLAN.md`
- Updated docs navigation:
  - `docs/INDEX.md`
