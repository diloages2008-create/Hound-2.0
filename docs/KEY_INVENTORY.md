# Key Inventory

Purpose: one source of truth for environment variables and secrets in Hound.

Rules:
- Never put secret keys in frontend (`VITE_*`) variables.
- Never commit real secret values to git.
- Keep production secrets only in platform dashboards (Vercel, Render, Supabase).

## Variable Map

| Variable | Type | Used By | Allowed Locations | Forbidden Locations |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_ANON_KEY` | public | Studio frontend | Vercel (`hound-studio`) env vars, local dev `.env` | Render worker, Supabase function secrets, git with real prod value |
| `VITE_HOUND_API_BASE` | public | Studio frontend | Vercel (`hound-studio`) env vars, local dev `.env` | secrets stores only |
| `VITE_HOUND_API_MODE` | public | Studio frontend | Vercel (`hound-studio`) env vars, local dev `.env` | secrets stores only |
| `SUPABASE_URL` | public-ish | Worker backend | Render (`hound-worker`) env vars | frontend-only envs |
| `SUPABASE_SERVICE_ROLE_KEY` | secret/admin | Worker backend | Render (`hound-worker`) env vars only | any `VITE_*`, browser, client code, git |
| `EDGE_SUPABASE_URL` | public-ish | Edge Function (`api-v1`) | Supabase Edge Function Secrets | frontend-only envs |
| `EDGE_SERVICE_ROLE_KEY` | secret/admin | Edge Function (`api-v1`) | Supabase Edge Function Secrets only | any `VITE_*`, browser, client code, git |
| `STORAGE_BUCKET_MASTERS` | config | Worker + Edge Function | Render env, Supabase Edge Function Secrets | n/a |
| `STORAGE_BUCKET_COVERS` | config | Edge Function | Supabase Edge Function Secrets | n/a |
| `STORAGE_BUCKET_STREAMS` | config | Worker + Edge Function | Render env, Supabase Edge Function Secrets | n/a |

## Current Production Targets

Use this project ref in all production URLs/keys:
- Supabase project ref: `rbhlvbutqzgqogsrqwet`
- Supabase URL: `https://rbhlvbutqzgqogsrqwet.supabase.co`

## Quick Audit Commands

Run from repo root:

```powershell
rg -n "service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|EDGE_SERVICE_ROLE_KEY|VITE_SUPABASE_ANON" .
```

Goal:
- no real secret values in tracked files
- `VITE_SUPABASE_ANON_KEY` should hold only anon/public key

## Rotation Checklist

1. Rotate secret key in Supabase (service role / secret API key).
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Render worker.
3. Update `EDGE_SERVICE_ROLE_KEY` in Supabase Edge Function Secrets.
4. Redeploy worker.
5. Redeploy `api-v1` function.
6. Smoke test: signup/login, submit, publish, stream playback.

## Safety Checks

- Browser `apikey` header must decode to `role: anon`, never `service_role`.
- If worker logs show `Unregistered API key`, worker key/project mismatch exists.
- If publish fails with `track not ready for publish`, check `transcode_jobs` and `tracks` readiness fields first.
