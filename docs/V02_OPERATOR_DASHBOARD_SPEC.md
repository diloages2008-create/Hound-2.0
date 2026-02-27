# v0.2 Operator Dashboard Spec (Minimum Viable Control)

Goal: Diagnose ingest/streaming health in under 2 minutes from one page.

## Scope

- This is an operator console, not end-user analytics.
- It must prioritize reliability, safety signals, and active incidents.
- "Ugly but correct" is acceptable for v0.2.

## Required Panels

## 1) Ingest Overview

- Uploads today (count).
- Uploads in last hour (count).
- Upload rejection rate (count + %).
- Top upload rejection reasons.

## 2) Transcode Queue Health

- Jobs by status (`queued`, `in_progress`, `retrying`, `failed`, `completed`).
- Oldest queued job age (minutes).
- p50 and p95 transcode duration (minutes).
- Retry distribution (how many jobs reached attempt 2, 3, etc.).

## 3) Worker Health

- Last worker heartbeat timestamp.
- Heartbeat age (seconds).
- Worker process restart count (24h).
- Claim-to-start latency (seconds).

## 4) Playback Reliability

- Play attempts (24h).
- Failed play attempts (24h).
- Failure rate (`failed / attempts`).
- Top stream error codes/messages.
- Failures by platform/browser (at least iOS Safari vs other).

## 5) Incident Feed

- Last 20 incidents/events:
  - timestamp
  - service area
  - severity
  - short impact line
  - linked runbook or ticket

## Required Filters

- Time range: `1h`, `6h`, `24h`, `7d`.
- Environment: `prod`, `staging`.
- Optionally artist/release filter for support debugging.

## Required Alerts

- Queue age threshold breached.
- Queue failure rate threshold breached.
- Missing worker heartbeat for >2 minutes.
- Playback failure rate threshold breached.
- 4xx/5xx spike on API gateway/functions.

## Alert Response Rules

- Every alert maps to:
  - owner role
  - response target time
  - runbook link
- Alert closures require note of:
  - root cause
  - mitigation applied
  - prevention follow-up

## Suggested SLO Targets (Set Explicit Numbers)

- Upload-to-live latency: 95% within `X` minutes.
- Transcode success rate: >= `Y%` over 24h.
- Playback failure rate: <= `Z%` over 24h.
- Worker heartbeat freshness: <= 120 seconds.

## Data Sources (Current Hound Context)

- API telemetry/event tables (play attempts, failures).
- Transcode job table/status fields.
- Release/track state fields used in publish flow.
- Worker heartbeat/health endpoint logs or heartbeat table.

## v0.2 Implementation Notes

- Start with SQL queries + one internal page.
- Add charting only after key counters are accurate.
- Prioritize correctness, refresh cadence, and alerting over visual polish.

## Done Criteria

- Operator can answer all in under 2 minutes:
  - How many transcodes failed today?
  - What is the oldest queued job right now?
  - Is worker alive right now?
  - What is play failure rate in the last 24h?
  - What is the top active failure cause?
