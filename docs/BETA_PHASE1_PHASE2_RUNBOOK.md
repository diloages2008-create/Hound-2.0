# Beta Lock + Stability Runbook

## Phase 1 (Immediate)

### 1) Closed beta gate
- `BETA_INVITE_ONLY=true` (default in API).
- `BETA_MAX_SIGNUPS=5` (set to `3`-`5` as needed).
- `BETA_ALLOWLIST_EMAILS=user1@example.com,user2@example.com` for trusted users.
- Optional token path: create rows in `beta_signup_invites`.

### 2) Mandatory issue report
- Studio: left nav has `Report an Issue`.
- Listener: gate + settings both have `Report an Issue`.
- Stored in `client_issue_reports` with:
  - `session_id`
  - `user_id` (if auth token present)
  - `route`
  - `client_timestamp`
  - `client_actions` (last 30)
  - `last_error_message`
  - `browser_info`
- API response includes `report_id`.

### 3) Operator visibility
- Studio `/operator` page reads `/v1/operator/overview`.
- Metrics:
  - uploads today
  - transcode queued
  - transcode failed (24h)
  - oldest job age (minutes)
  - play attempts vs failures (24h)

## Phase 2 (This week)

### 4) 10 upload stress test
1. Upload 10 small tracks through Studio.
2. Watch `/operator` page during upload + transcode.
3. Run checks:
   - stuck jobs:
     - `select job_id, status, created_at, updated_at from transcode_jobs where status in ('queued','in_progress','failed') order by created_at asc;`
   - duplicate publish:
     - `select release_id, count(*) from releases where status='live' group by release_id having count(*) > 1;`
   - queue backlog:
     - `select count(*) from transcode_jobs where status='queued';`
   - long transcode:
     - `select job_id, extract(epoch from (coalesce(completed_at, now()) - started_at))/60 as minutes from transcode_jobs where started_at is not null order by minutes desc limit 10;`

### 5) Laptop-off test (formal)
1. Start with worker + API deployed.
2. Shut laptop fully.
3. From phone:
   - upload from Studio
   - stream from Listener
4. Repeat once more.
5. Pass criteria:
   - upload completes
   - transcode completes
   - stream resolves and plays
   - no local-machine dependency observed
