# v0.2 Verification Checklist (Operator Sign-Off)

Use this checklist to validate "Always-On Beta" readiness.  
Each line must have an owner, evidence link, and pass/fail.

## Reliability

- [ ] Worker crash is detected within 2 minutes.
- [ ] Worker auto-restarts without manual intervention.
- [ ] Queue depth is visible.
- [ ] Oldest queued job age is visible.
- [ ] Retry policy is enforced (max attempts + backoff).
- [ ] Retry behavior is idempotent (no duplicate publish state).
- [ ] Concurrency locking prevents double-processing by two workers.
- [ ] Backlog SLO is defined: 95% of uploads finish within `X` minutes.
- [ ] Backlog SLO is met in a 50-upload test day.

## Safety

- [ ] Protected endpoints enforce auth server-side.
- [ ] Role checks are enforced server-side.
- [ ] Cross-user access tests fail as expected (no data leakage).
- [ ] Master/source storage cannot be listed by unauthorized users.
- [ ] Max file size is enforced server-side.
- [ ] MIME/extension whitelist is enforced server-side.
- [ ] Per-artist daily upload cap is enforced.
- [ ] Rate limiting is active on auth endpoints.
- [ ] Rate limiting is active on upload-intent endpoints.
- [ ] Rate limiting is active on telemetry endpoints.
- [ ] Service keys are absent from client bundles and runtime logs.

## Streaming Experience

- [ ] Buffering state appears during network stalls.
- [ ] HLS failure shows user-facing error text (no silent fail).
- [ ] Retry executes automatically with capped attempts.
- [ ] Reconnect policy is defined and observed in test.
- [ ] Playback resumes or restarts exactly as policy states.
- [ ] Failed play attempts generate telemetry events.
- [ ] iPhone Safari playback path is validated.
- [ ] Bad LTE and high-packet-loss test scenario is validated.
- [ ] Background-tab throttling scenario is validated.

## Observability

- [ ] Operator dashboard exists with live values for uploads today.
- [ ] Operator dashboard shows transcode status counts.
- [ ] Operator dashboard shows failures in the last 24h.
- [ ] Operator dashboard shows play attempts vs play failures.
- [ ] Alert triggers exist for queue age threshold.
- [ ] Alert triggers exist for failure-rate threshold.
- [ ] Alert triggers exist for missing worker heartbeat (>2 minutes).
- [ ] Incident log template/process is in use.

## Beta Gate

- [ ] 50 uploads/day pass without manual queue surgery.
- [ ] Worker restart test passes with no data loss.
- [ ] Hide/unpublish release action can be executed quickly.
- [ ] Real-time error detection is confirmed.
- [ ] In-product bug-report path is live.

## Test Drills (This Week)

- [ ] Run 10 fake upload stress test.
- [ ] Simulate worker crash during active queue.
- [ ] Simulate bad network during playback.
- [ ] Simulate spam upload attempts.
- [ ] Record outcomes and follow-up fixes in incident log.

## Sign-Off

- Operator:
- Engineering Lead:
- Date:
- Evidence location:
- Final result (`PASS`/`HOLD`):
