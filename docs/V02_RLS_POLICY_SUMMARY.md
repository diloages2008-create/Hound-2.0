# v0.2 RLS Policy Summary

Date: 2026-02-27  
Scope: `public` schema tables used by Hound backend.

## Classification by Table

- `app_users`: Owner-only (`SELECT` own row only).
- `artist_profiles`: Owner-only (`SELECT/INSERT/UPDATE` own profile; onboarding locked to pending for client paths).
- `artist_rights_attestations`: Owner-only (`SELECT/INSERT` for caller-owned artist profile).
- `releases`: Public-read (published only) + owner manage draft/submitted/in_transcode/rejected.
- `tracks`: Public-read (when parent release is `live`) + owner write.
- `track_credits`: Public-read (when parent release is `live`) + owner write.
- `upload_assets`: Owner-only; client can only write artist upload kinds (`master_audio`, `cover_art`).
- `transcode_jobs`: Worker-only (no anon/authenticated grants, no client policies).
- `listener_play_events`: Insert-only telemetry (`INSERT` own listener id only).
- `listener_event_log`: Insert-only telemetry (`INSERT` own listener id only).
- `listener_track_saves`: Owner-only (`SELECT/INSERT/UPDATE/DELETE` own rows).
- `album_similarity_edges`: Worker-only (no anon/authenticated grants, no client policies).

## Guardrails Enforced

- No unrestricted `SELECT` on any table.
- No unrestricted `INSERT/UPDATE/DELETE` on any table.
- `transcode_jobs` is not client-writable.
- `album_similarity_edges` is not client-readable or writable.
- Telemetry tables are insert-only for authenticated caller-owned rows.
- Draft catalog visibility is owner-only via RLS and listener route checks.

## Compatibility Notes

- Service role paths (`api-v1`, worker) continue to function because service role bypasses RLS by design.
- Listener public endpoints additionally enforce `status = 'live'` for album detail and track stream resolution.
