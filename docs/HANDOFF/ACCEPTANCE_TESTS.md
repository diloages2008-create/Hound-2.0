# Acceptance Tests

Status: [ACTIVE]

## v0.2 Always-On Beta Gate

All sections require evidence. Any failed item blocks beta invite rollout.

## Track A: Worker Infrastructure

- [x] Worker deploys and runs in managed host (Render background worker).
- [x] Manual restart validated without immediate crash loop.
- [ ] Laptop-off end-to-end proof (upload -> transcode -> stream) from non-local device.

## Track B: Security / RLS

- [x] RLS enabled on all public tables.
- [x] Draft access denied to anon and non-owner artist.
- [x] Telemetry spoof attempt (`listener_user_id` mismatch) denied.
- [x] Listener public APIs restricted to live content.
- [x] Worker/service-role access path still functional.

## Track C: Observability

- [ ] Worker heartbeat updates every 60 seconds.
- [ ] Missing heartbeat state (>2 minutes) queryable and testable.
- [ ] Queue depth and oldest-job age queryable in production.
- [ ] Operator surface exposes core counters (uploads, queue states, failures).

## Track D: Abuse Guardrails

- [ ] Upload file-size caps enforced server-side.
- [ ] MIME whitelist enforced server-side.
- [ ] Per-artist daily upload cap enforced.
- [ ] Rate limiting enabled for upload intents and telemetry ingest.

## Evidence Sources

- Render events/logs for runtime health.
- Supabase migration/function deployment output.
- API responses from production checks.
- Drill artifacts described in `docs/V02_72_HOUR_DRILL_PLAN.md`.
