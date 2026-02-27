-- Incremental v0.1 hardening migration
-- Date: 2026-02-27

alter table tracks
  add column if not exists loudness_lufs numeric(6,2);

alter table listener_play_events
  add column if not exists client_event_id text;

create unique index if not exists uq_listener_play_events_client_event_id
  on listener_play_events(client_event_id)
  where client_event_id is not null;

create table if not exists listener_event_log (
  event_id text primary key,
  listener_user_id uuid not null references app_users(user_id) on delete cascade,
  track_id uuid not null references tracks(track_id) on delete cascade,
  event_type text not null check (event_type in ('play_start', 'progress_25', 'progress_50', 'progress_75', 'progress_95', 'skip', 'complete')),
  event_time timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists listener_track_saves (
  listener_user_id uuid not null references app_users(user_id) on delete cascade,
  track_id uuid not null references tracks(track_id) on delete cascade,
  saved boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (listener_user_id, track_id)
);
