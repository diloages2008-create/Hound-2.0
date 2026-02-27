# Hound Studio App

Artist-facing web app for onboarding, profile, releases, and upload workflow.

## Folder Map

- `src/pages/`: Dashboard, Upload, Library, Profile.
- `src/components/`: shared Studio shell/navigation.
- `src/lib/`: API client + mock adapter.

## Run

- `npm run dev`: start Studio in dev mode.
- `npm run build`: production build.

## Env

- `.env`: `VITE_HOUND_API_MODE`, `VITE_HOUND_API_BASE`.
- `.env.example`: template for local setup.

## Related Infra

- Supabase API function: `../hound-listener/supabase/functions/api-v1`.
- Ops runbooks: `../../ops/README.md`.
