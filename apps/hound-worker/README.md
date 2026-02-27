# Hound Worker

Dedicated transcode worker for v0.1 ingestion.

## Required env
- `SUPABASE_URL` (preferred; `EDGE_SUPABASE_URL` alias supported)
- `SUPABASE_SERVICE_ROLE_KEY` (preferred; `EDGE_SERVICE_ROLE_KEY` alias supported)
- `STORAGE_BUCKET_MASTERS` (default: `hound-masters`)
- `STORAGE_BUCKET_STREAMS` (default: `hound-streams`)
- `WORKER_CONCURRENCY` (default: `1`)
- `WORKER_POLL_MS` (default: `3000`)
- `WORKER_ID` (optional)
- `NODE_ENV` (recommended: `production` in Render)

## Not required by worker
- `SUPABASE_ANON_KEY` is currently unused by `apps/hound-worker/src/index.mjs`.

## Run
`npm run worker:start`

## Behavior
- Claims jobs through `claim_transcode_job(worker_id)` SQL function.
- Runs ffprobe + ffmpeg.
- Uploads HLS manifest/segments to streams bucket.
- Writes duration + loudness + manifest path.
- Marks source asset processed and job completed.
- Retries failed jobs with exponential backoff up to `max_attempts`.
