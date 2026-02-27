# Developer Brief

Status: [ACTIVE]

## Current Operational Stage (2026-02-27)

- Stage: `Alpha 0.9 -> v0.2 transition`
- Primary objective: Always-On Beta stability, not feature expansion.

## Confirmed Implemented

- End-to-end release pipeline is functional (`draft -> upload -> submit -> transcode -> publish`).
- Worker deployment path is active on Render (`hound-worker-prod`).
- RLS lockdown migration is applied in production.
- Listener public endpoints are hardened to `live` content only for album/stream.
- v0.2 operator docs are present:
  - `docs/DEFINITION_OF_STABLE_V02.md`
  - `docs/V02_VERIFICATION_CHECKLIST.md`
  - `docs/V02_OPERATOR_DASHBOARD_SPEC.md`
  - `docs/V02_72_HOUR_DRILL_PLAN.md`
  - `docs/V02_RLS_POLICY_SUMMARY.md`

## In-Progress Verification Tracks

- Receipt 1 (Worker Infrastructure):
  - `LIVE`: passed
  - `RESTART`: passed
  - `LAPTOP_OFF`: pending (requires public frontend URL reachable from non-local device)
- Receipt 2 (Heartbeat/alert path): pending
- Receipt 3 (Backlog visibility): pending
- Receipt 4 (Crash/idempotency proof): pending
- Receipt 5 (Laptop-off full E2E proof): pending

## Immediate Next Actions

1. Deploy public web URLs for Studio and Listener (non-local access required for laptop-off test).
2. Execute Receipt 1 laptop-off checkpoint with evidence.
3. Implement worker heartbeat table/query + missing-heartbeat alert condition.
4. Stand up minimal operator dashboard/queries (queue depth, oldest job age, fail counts).

## Hard Constraints

- No new product features until v0.2 stability gate passes.
- No secrets in chat or committed config files.
- Service-role keys are server-only; never available in client/runtime bundles.
