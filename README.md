# Hound Monorepo

This repo has three runtime apps and two shared packages.

## Quick Start

```bash
npm install
npm run listener:dev
npm run studio:dev
```

## Top-Level Map

- `apps/hound-listener/`: Listener desktop app (Electron + UI) and Supabase backend source.
- `apps/hound-studio/`: Artist-facing Studio web app.
- `apps/hound-worker/`: Dedicated transcode worker (ffmpeg/ffprobe).
- `packages/domain-types/`: Shared contracts and normalization helpers.
- `packages/rules-engine/`: Shared scoring and recommendation rules.
- `ops/`: Deployment and end-to-end verification scripts.
- `docs/`: Capabilities, history, handoff specs.

## Most Important Commands

- `npm run listener:dev`: Start Listener web mode (web-first).
- `npm run studio:dev`: Start Studio web app.
- `npm run worker:start`: Start transcode worker.
- `npm run studio:build`: Build Studio.
- `npm run listener:build`: Build Listener.
- `npm run packages:test`: Run shared package tests.

## v0.1 Infra Runbooks

- Deploy backend and secrets: `ops/deploy-v01.ps1`
- Verify first real release loop: `ops/verify-first-release.ps1`

See `ops/README.md` for copy/paste usage.

## Web-First Mode

Electron runtime and packaging scripts are intentionally disabled for now.
Desktop packaging is deferred until Web v1 stability is complete.

## Local Secrets

- Keep real secret files outside the repo at:
  - `%USERPROFILE%\.hound-secrets\hound-studio\.env`
  - `%USERPROFILE%\.hound-secrets\hound-listener\.env`
  - `%USERPROFILE%\.hound-secrets\den.env`
- Optional overrides:
  - `HOUND_STUDIO_ENV_DIR` for Studio Vite env directory.
  - `HOUND_LISTENER_ENV_DIR` for Listener UI Vite env directory.
