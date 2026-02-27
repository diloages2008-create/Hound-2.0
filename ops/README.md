# Ops Runbooks

This folder is the operational entry point for v0.1 backend deployment and verification.

## Files

- `deploy-v01.ps1`: Applies migrations, sets Supabase function secrets, deploys `api-v1`.
- `verify-first-release.ps1`: Runs end-to-end release ingestion and listener stream verification.

## 1) Deploy v0.1 backend

```powershell
.\ops\deploy-v01.ps1 `
  -SupabaseProjectRef "YOUR_PROJECT_REF" `
  -EdgeSupabaseUrl "https://YOUR_PROJECT_REF.supabase.co" `
  -EdgeServiceRoleKey "YOUR_SERVICE_ROLE_KEY" `
  -StorageBucketMasters "hound-masters" `
  -StorageBucketCovers "hound-covers" `
  -StorageBucketStreams "hound-streams"
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

On success the script prints:
- `releaseId`
- `trackId`
- `manifest` URL
- telemetry `eventId`

## Notes

- Keep `WORKER_CONCURRENCY` low (`1` or `2`) for v0.1 stability.
- If publish times out, inspect `transcode_jobs` and worker logs before retrying.
- Rotate any service-role key that has ever been committed or stored in plaintext.
