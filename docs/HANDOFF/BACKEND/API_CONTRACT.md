# API Contract

Status: [DEFINED]

Canonical source:
- `docs/HANDOFF/BACKEND/OPENAPI_V1.yaml`

Scope covered:
- Artist auth/signup + rights attestation
- Studio profile and release lifecycle
- Upload intents for masters and cover art
- Listener home, album detail, stream manifest resolution
- Telemetry ingest and lightweight suggested-next albums

Notes:
- This is the v1 baseline for both Studio and Listener.
- Any endpoint changes should be made in `OPENAPI_V1.yaml` first, then reflected in app code.
