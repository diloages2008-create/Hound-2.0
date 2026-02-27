# v0.2 72-Hour Drill Plan

Purpose: pressure-test Always-On Beta readiness before inviting external artists.

## Rules

- Run drills in staging first, then production-safe simulation where possible.
- Capture evidence during each drill.
- A drill is not complete without a pass/fail decision and follow-up owner.

## Evidence Table

| Drill ID | Scenario | How to Trigger (No Code) | Expected Behavior | Dashboard Signal | Alert | Evidence (Screenshot/Log Link) | Pass/Fail | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Worker crash mid-transcode | Start a transcode with active queue, then terminate worker process/container while job is in `in_progress`. | Job is recovered safely after restart (requeued or resumed by policy), no duplicate publish artifacts, no stuck lock. | Queue depth rises briefly; oldest-job age increases then normalizes; worker heartbeat gap visible. | Missing heartbeat alert within 2 minutes; optional queue-age warning if threshold crossed. |  |  |  |  |
| D2 | 50 uploads in one day (queue pressure) | Submit 50 valid test uploads across the day (batched and burst periods). | System meets backlog SLO (95% within defined `X` minutes), no manual queue surgery required. | Uploads/day and queued jobs increase; p95 processing time remains within target band. | Queue-age and failure-rate alerts remain below trigger threshold. |  |  |  |  |
| D3 | Poison job (bad file fails) | Submit one intentionally invalid/corrupt file among valid uploads. | Bad file fails cleanly, retries stop at max attempts, other jobs continue processing. | Failed-job count increments by 1; retries visible for poison job only. | Job failure-rate alert only if threshold crossed. |  |  |  |  |
| D4 | Streaming on bad Wi-Fi (drop/reconnect) | Play a track on throttled/unstable network, force temporary disconnect, then reconnect. | UI shows buffering/retrying state, playback resumes/restarts per policy, no silent failure. | Play-attempt and retry/failure counters reflect disruption. | Playback failure-rate alert only if threshold crossed. |  |  |  |  |
| D5 | Abuse attempt (spam upload intents + telemetry spam) | Rapidly repeat upload-intent requests and telemetry events from one client/IP. | Rate limits/throttles activate, system remains responsive for normal users, no queue poisoning. | 4xx rate rises predictably; upload-intent/telemetry rejection counts increase. | API 4xx/5xx spike alert if configured threshold crossed. |  |  |  |  |

## Pass Criteria (Global)

- No silent failure path in ingest or playback.
- Alerts fire when expected and map to a runbook.
- Incident can be diagnosed from dashboard/queries in under 2 minutes.
- Evidence is captured for each drill and stored in a shared location.

## Failure Handling

- Any failed drill blocks beta gate.
- For each failure, record:
  - root cause
  - mitigation
  - prevention task
  - owner and deadline

## Sign-Off

- Operator:
- Engineering:
- Date:
- Final result (`PASS` / `HOLD`):
