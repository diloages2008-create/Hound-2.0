# Hound Master Capability List (Merged)

This file merges the prior capability matrix with `docs/CODEX_HISTORY.md` and is now the primary capability reference.
Last merged: 2026-02-24.

## Snapshot (Repo Shape)
- Monorepo with `apps/` and `packages/` workspaces.
- `apps/hound-listener`: Electron + Vite + React desktop app.
- `apps/hound-studio`: React web app for artist workflows.
- `packages/domain-types`: shared contracts + normalization helpers (implemented).
- `packages/rules-engine`: shared orbit/recommendation rules (implemented).
- `ops/`: deploy + verification runbooks/scripts for v0.1 backend loop.
- `docs/`: capability, handoff, and acceptance references.

## Listener App Capabilities

### 1) Playback Engine
Can
- Load local audio via `houndfile://` protocol.
- Play, pause, next, previous, seek, stop.
- Crossfade between tracks (settings-dependent).
- Apply loudness normalization per track (analysis + gain).
- Prioritize queue playback when queue exists.

Cannot
- Stream remote network audio catalogs yet.
- Handle generic remote URLs as track sources.

Key files
- `apps/hound-listener/ui/src/App.jsx`
- `apps/hound-listener/electron/main.cjs`
- `apps/hound-listener/electron/preload.cjs`

### 2) Import and Library
Can
- Import local audio (`mp3`, `wav`, `m4a`, `flac`, `aac`, `alac`, `ogg`, `opus`).
- Show library in table layout (title/artist/album/duration).
- Provide context actions and hover actions.

Cannot
- Watch folders continuously.
- Run automatic folder scans.

Key files
- `apps/hound-listener/ui/src/App.jsx`
- `apps/hound-listener/electron/main.cjs`

### 3) Rotation, Save, and Orbit Signals
Can
- Toggle save/unsave and manual rotation override.
- Maintain orbit-related track state (rotation/recent/discovery signals).
- Apply long-term ignore decay and discovery fallback behavior.

Cannot
- Expose final weighted orbit autoplay behavior as complete v1 policy.

Key files
- `apps/hound-listener/ui/src/App.jsx`
- `docs/HANDOFF/GAP_ANALYSIS.md`

### 4) Telemetry and Analytics Capture
Can
- Capture play telemetry per play (listen %, skip timing, completion, replay).
- Use telemetry in local track state and scoring behavior.

Cannot
- Provide finished external analytics reporting/export pipeline.

Key files
- `apps/hound-listener/ui/src/App.jsx`

### 5) Queue, Search, Now Playing, and Shell UI
Can
- Queue add, reorder, clear, and queue-first playback.
- Search by track/artist/album views.
- Use now-playing controls and bottom mini-player.
- Use custom right-click context menu actions.

Cannot
- Show final credits/lyrics enriched now-playing experience.
- Show completed recommendation explanations.

Key files
- `apps/hound-listener/ui/src/App.jsx`

### 6) Persistence and Analysis Backend (Desktop Local)
Can
- Persist listener data in SQLite (`apps/hound-listener/data/hound.db`).
- Store tracks, prefs, orbits, playback events, embeddings, and metrics.
- Use IPC handlers for library/prefs/events/orbit/analysis workflows.

Cannot
- Sync with a remote production backend by default.

Key files
- `apps/hound-listener/electron/db.cjs`
- `apps/hound-listener/electron/main.cjs`
- `apps/hound-listener/electron/analysis-worker.cjs`

### 7) Listener Cloud Catalog Bridge (v1 Verification Mode)
Can
- Login against cloud auth endpoint and store bearer token locally.
- Fetch listener home rails from backend API.
- Fetch album detail from backend API.
- Resolve track stream manifest URLs from backend API.
- Run in `mock` mode with deterministic local responses (`VITE_HOUND_API_MODE=mock`) for backend-free verification.

Cannot
- Play remote HLS manifests end-to-end in production flow yet (UI bridge currently for verification).

Key files
- `apps/hound-listener/ui/src/App.jsx`

## Studio App Capabilities (Artist Side)

### 1) Artist Workflow UI (v1)
Can
- Provide artist-focused shell and navigation.
- Show Dashboard, Upload, Catalog, and Profile pages.
- Represent onboarding checks, rights confirmation, and metadata workflows.
- Keep album-first catalog presentation with visible credits.
- Support responsive layouts across desktop/mobile widths.
- Call live backend endpoints for artist signup/login, profile load/update, and release draft creation.
- Call live backend endpoints for artist signup/login, profile load/update, release list, and release draft creation.
- Run in `mock` mode with local in-browser persistence (`VITE_HOUND_API_MODE=mock`) for backend-free verification.

Cannot
- Execute full upload-intent + release-submit pipeline from Studio UI yet.

Key files
- `apps/hound-studio/src/App.jsx`
- `apps/hound-studio/src/components/StudioShell.jsx`
- `apps/hound-studio/src/pages/*.jsx`
- `apps/hound-studio/src/data/studioData.js`
- `apps/hound-studio/src/styles.css`
- `apps/hound-studio/src/lib/apiClient.js`

### 2) Upload Pipeline Representation
Can
- Capture payload shape for master file, cover art, metadata, mood tags, credits, lyrics.
- Show pipeline stages (integrity check, transcode, storage write, catalog entry) in UI.

Cannot
- Perform actual cloud upload/transcode/CDN publish in-app yet.

Key files
- `apps/hound-studio/src/pages/Upload.jsx`

## Access Gate and Supabase
Can
- Define invite/device/session schema.
- Run `checkin` and `redeem` edge functions.
- Run `api-v1` edge function scaffold for Studio/Listener contract endpoints.
- Apply v1 backend schema migration from `supabase/migrations`.
- Authenticate protected `api-v1` routes with Supabase JWT Bearer tokens.
- Serve auth session lifecycle endpoints (`/auth/me`, `/auth/refresh`, `/auth/logout`).
- Serve ingestion endpoints for upload intents, upload completion, release submit, and publish.
- Accept idempotent cloud telemetry ingest (`client_event_id` + event log endpoint).
- Sync cloud save/unsave state endpoint for listener tracks.
- Enforce release state progression server-side (`draft -> submitted -> in_transcode -> live`, with reject path).
- Queue transcode jobs at submission time (no simulated completion in submit).
- Run dedicated transcode worker process (`apps/hound-worker`) with ffmpeg/ffprobe pipeline.

Cannot
- Serve as complete production auth + entitlement + billing layer yet.
- Return full auth session token directly from signup (login endpoint provides bearer token).

Key files
- `apps/hound-listener/supabase/schema.sql`
- `apps/hound-listener/supabase/functions/checkin/index.ts`
- `apps/hound-listener/supabase/functions/redeem/index.ts`
- `apps/hound-listener/supabase/functions/api-v1/index.ts`
- `apps/hound-listener/supabase/migrations/20260224_000001_backend_v1.sql`

## Shared Packages (Implemented)

### 1) `@hound/domain-types`
Can
- Provide shared orbit and rotation constants.
- Normalize track objects into a stable contract.
- Validate telemetry payload key presence.
- Export helpers (`clamp`, `toISO`) for shared use.

Key files
- `packages/domain-types/index.cjs`
- `packages/domain-types/index.mjs`
- `packages/domain-types/tests/domain-types.test.cjs`

### 2) `@hound/rules-engine`
Can
- Score tracks from telemetry and policy values.
- Build orbit pools (`rotation`, `recent`, `discovery`) from shared contracts.
- Select next track with queue-first, then orbit-priority logic.
- Suggest next albums from shared tags + listener behavior signals.

Key files
- `packages/rules-engine/index.cjs`
- `packages/rules-engine/index.mjs`
- `packages/rules-engine/tests/rules-engine.test.cjs`

## Confirmed Gaps / Not Built Yet
- Listener native HLS playback robustness across all targets (current implementation supports remote URL playback; full production HLS compatibility still needs wider client/device validation).
- Full bucket policy hardening and operational SLO/alerts (core live flow now works).
- Final recommendation weighting and advanced recommendation system.
- Full policy hardening (rate limits, stricter row-level policies, abuse controls) for `api-v1`.

## Next Work Targets
1) Move worker from local process to dedicated always-on runtime (container/hosted worker).
2) Add monitoring/alerts for transcode failures and publish readiness errors.
3) Run listener playback validation on target devices/networks for HLS robustness.
4) Add integration tests that consume shared packages and live API contracts from app code paths.
5) Add policy hardening (RLS, quotas, and abuse protections) for production rollout.
