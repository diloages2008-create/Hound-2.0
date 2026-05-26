# Ops Runbooks

This folder is the operational entry point for v0.1 backend deployment and verification.

## Files

- `deploy-v01.ps1`: Applies migrations, sets Supabase function secrets, deploys `api-v1`.
- `deploy-all.ps1`: One-command deploy for Supabase + Vercel + Render using env tokens.
- `verify-first-release.ps1`: Runs end-to-end release ingestion and listener stream verification.
- `stress-10-uploads.ps1`: Runs 10 sequential upload->submit->publish loops and snapshots operator metrics after each run.
- `laptop-off-test.md`: Formal mobile-only infrastructure independence test.

## 1) Deploy v0.1 backend

Place secrets in `%USERPROFILE%\.hound-secrets\den.env` (recommended):

```env
SUPABASE_PROJECT_REF=YOUR_PROJECT_REF
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Then run:

```powershell
.\ops\deploy-v01.ps1
```

Or pass values directly:

```powershell
.\ops\deploy-v01.ps1 `
  -SupabaseProjectRef "YOUR_PROJECT_REF" `
  -EdgeSupabaseUrl "https://YOUR_PROJECT_REF.supabase.co" `
  -EdgeServiceRoleKey "YOUR_SERVICE_ROLE_KEY" `
  -StorageBucketMasters "hound-masters" `
  -StorageBucketCovers "hound-covers" `
  -StorageBucketStreams "hound-streams"
```

## 1b) Deploy all online surfaces (Supabase + Vercel + Render)

Set these secrets in `%USERPROFILE%\.hound-secrets\den.env`:

```env
SUPABASE_PROJECT_REF=YOUR_PROJECT_REF
EDGE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EDGE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
VERCEL_TOKEN=YOUR_VERCEL_TOKEN
RENDER_API_KEY=YOUR_RENDER_API_KEY
RENDER_SERVICE_IDS=srv-xxxx,srv-yyyy
```

Run:

```powershell
.\ops\deploy-all.ps1
```

Useful switches:

```powershell
.\ops\deploy-all.ps1 -SkipRender
.\ops\deploy-all.ps1 -SkipSupabase
.\ops\deploy-all.ps1 -SkipVercel -ListenerUrl "https://hound-listener.vercel.app"
```

## 2) Run worker

```powershell
$env:EDGE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:EDGE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:STORAGE_BUCKET_MASTERS="hound-masters"
$env:STORAGE_BUCKET_STREAMS="hound-streams"
$env:WORKER_CONCURRENCY="1"
$env:WORKER_POLL_MS="3000"
npm run worker:start
```

## 3) Verify first real job + streaming loop

```powershell
.\ops\verify-first-release.ps1 `
  -ApiBase "https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-v1" `
  -StudioEmail "artist+verify@hound.fm" `
  -StudioPassword "CHANGE_ME_Artist_123!" `
  -ListenerEmail "listener+verify@hound.fm" `
  -ListenerPassword "CHANGE_ME_Listener_123!" `
  -AudioFilePath "C:\path\to\track.wav" `
  -CoverFilePath "C:\path\to\cover.jpg"
```

Note: signup fallback is disabled by default for closed beta safety.
If you explicitly want fallback signup behavior in a non-production sandbox, pass:

```powershell
-AllowSignupFallback
```

## 4) Run 10-upload stress test

```powershell
.\ops\stress-10-uploads.ps1 `
  -ApiBase "https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-v1" `
  -StudioEmail "artist+verify@hound.fm" `
  -StudioPassword "CHANGE_ME_Artist_123!" `
  -ListenerEmail "listener+verify@hound.fm" `
  -ListenerPassword "CHANGE_ME_Listener_123!" `
  -AudioFilePath "C:\path\to\track.wav" `
  -CoverFilePath "C:\path\to\cover.jpg"
```

Outputs:
- per-run success/failure and duration
- operator overview snapshot after each run (`uploadsToday`, `transcodeQueued`, `transcodeFailed24h`, `oldestJobAgeMinutes`, `playAttempts24h`, `playFailures24h`)
- JSON run log saved under `ops/stress-10-uploads-<timestamp>.json`

On success the script prints:
- `releaseId`
- `trackId`
- `manifest` URL
- telemetry `eventId`

## Notes

- Keep `WORKER_CONCURRENCY` low (`1` or `2`) for v0.1 stability.
- If publish times out, inspect `transcode_jobs` and worker logs before retrying.
- Rotate any service-role key that has ever been committed or stored in plaintext.
