# v0.2 Definition of Stable (72-Hour Test)

Owner: Founder/Operator  
Audience: Engineering + Ops  
Purpose: Define non-negotiable readiness criteria for "Always-On Beta".

## Reliability

- Worker crash detection happens within 2 minutes.
- Queue depth and oldest-job age are visible at all times.
- Job processing is idempotent; retries cannot duplicate publish state.
- Max retry policy is enforced (target: 3 attempts with backoff).
- Two workers cannot process the same job concurrently.
- Backlog SLO is defined and measured:
  - 95% of uploads processed within `X` minutes (set `X` explicitly).

## Safety

- Server-side auth and role checks are enforced on every protected endpoint.
- Cross-user data access is blocked for Studio and Listener APIs.
- Upload restrictions are enforced server-side:
  - max file size
  - allowed MIME types/extensions
  - per-artist daily upload cap
- Abuse protection exists:
  - request rate limits
  - upload-intent throttling
- Service keys are never exposed in client code, runtime logs, or error payloads.

## Streaming Experience

- Player shows explicit buffering state.
- HLS failures are user-visible (no silent failure path).
- Auto-retry exists with capped attempts.
- Reconnect behavior is defined (resume from timestamp or restart).
- Failed stream attempts are logged as events.

## Observability

- One operator view/query set exists for:
  - uploads today
  - transcode jobs by status (`queued`, `in_progress`, `failed`, `completed`)
  - failures in last 24h
  - play attempts vs play failures
- Alerts exist for:
  - queue age above threshold
  - failure rate above threshold
  - missing worker heartbeat for more than 2 minutes
- Incident log process exists with:
  - timestamp
  - impact
  - fix
  - prevention action

## Beta Gate (All Must Be Yes)

- System survives 50 uploads/day without manual queue surgery.
- Worker restart causes no data loss and no permanently stuck jobs.
- Release can be hidden/unpublished quickly.
- Errors are detectable in real time.
- Users have an in-product bug-report path.

## Current Status (2026-02-27)

- Current stage: `Alpha 0.9` (functional, operationally fragile).
- Major blocker: always-on managed worker hosting is not yet guaranteed.
- Remaining risk domains: production hardening, streaming stress behavior, and operator observability.
