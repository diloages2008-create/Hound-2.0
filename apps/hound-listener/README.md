# Hound Listener App

Listener desktop app with local playback plus cloud-catalog bridge.

## Folder Map

- `ui/`: React/Vite listener UI.
- `electron/`: main/preload/db/analysis runtime.
- `supabase/`: backend function + migrations.
- `data/`: local SQLite and runtime data.

## Run

- `npm run start` / `npm run dev:web`: web-first listener UI.
- `npm run dev:web`: Browser-only UI (no Electron IPC/import).
- `npm run build`: Build renderer.

## Web-First Status

Electron runtime and packaging (`dev:app`, `electron`, `pack`, `dist`) are currently disabled.
They are deferred until Web v1 is stable.

## Env

- `.env`: listener UI env (`VITE_HOUND_API_MODE`, `VITE_HOUND_API_BASE`).
- `supabase/functions/api-v1`: uses secrets in Supabase project.

## Related Infra

- Worker service: `../hound-worker/`.
- Ops runbooks: `../../ops/README.md`.

