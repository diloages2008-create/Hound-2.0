-- Fix telemetry idempotency upsert conflict target
-- Date: 2026-02-28

drop index if exists uq_listener_play_events_client_event_id;

create unique index if not exists uq_listener_play_events_client_event_id
  on listener_play_events(client_event_id);
