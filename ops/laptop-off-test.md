# Laptop-Off Test (Formal)

Purpose: prove infrastructure independence from the developer laptop.

## Preconditions

- Backend deployed (`api-v1`) and reachable.
- Worker running in hosted environment (not local laptop).
- At least one listener + one artist beta account is active.
- App URLs are public and reachable from mobile network.

## Procedure (Run Twice)

1. From phone, log into Studio.
2. Upload one small audio file and cover.
3. Submit and publish.
4. From phone, open Listener and play the newly published track.
5. Confirm playback starts and reaches at least 20 seconds.
6. Repeat steps 1-5 for a second track/release.

## Laptop-Off Condition

- Shut down dev laptop completely before step 1.
- Do not use local tunnels/dev servers.

## Pass/Fail

Pass if all are true:
- both uploads complete
- both transcodes complete
- both publishes succeed
- both listener streams play on phone
- operator metrics continue updating during test

Fail if any upload/transcode/publish/play action requires local laptop recovery.

## Evidence To Save

- Timestamped screenshots for:
  - Studio upload state transitions
  - publish success
  - Listener playback screen
  - Operator page metrics before and after test
- Incident notes for any failure with report IDs from "Report an Issue".
