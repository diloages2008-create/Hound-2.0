# Hound Studio API Contract

Status: [DEFINED]

Canonical source:
- `docs/HANDOFF/BACKEND/OPENAPI_V1.yaml`

Studio endpoints (v1):
- `POST /v1/auth/artist/signup`
- `GET/PUT /v1/studio/profile`
- `POST /v1/studio/releases`
- `POST /v1/studio/releases/{releaseId}/uploads/master-intent`
- `POST /v1/studio/releases/{releaseId}/uploads/cover-intent`
- `POST /v1/studio/releases/{releaseId}/submit`

Implementation note:
- Studio UI forms should serialize directly to these request schemas.
