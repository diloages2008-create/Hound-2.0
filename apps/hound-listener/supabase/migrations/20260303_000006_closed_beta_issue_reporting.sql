-- Closed beta controls + issue reporting + stream reliability counters
-- Date: 2026-03-02

begin;

create table if not exists beta_signup_invites (
  invite_token text primary key,
  role text check (role in ('artist', 'listener')),
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  revoked boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists client_issue_reports (
  report_id uuid primary key default gen_random_uuid(),
  app_surface text not null check (app_surface in ('studio', 'listener')),
  session_id text not null,
  user_id uuid references app_users(user_id) on delete set null,
  route text not null,
  client_timestamp timestamptz not null,
  last_error_message text,
  browser_info jsonb not null default '{}'::jsonb,
  client_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists listener_stream_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  requested_track_id text not null,
  track_id uuid references tracks(track_id) on delete set null,
  listener_user_id uuid references app_users(user_id) on delete set null,
  success boolean not null,
  failure_reason text,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_client_issue_reports_created_at
  on client_issue_reports(created_at desc);

create index if not exists idx_client_issue_reports_user
  on client_issue_reports(user_id, created_at desc);

create index if not exists idx_listener_stream_attempts_attempted_at
  on listener_stream_attempts(attempted_at desc);

create index if not exists idx_listener_stream_attempts_success
  on listener_stream_attempts(success, attempted_at desc);

-- Service-role only tables. Force RLS and revoke anon/authenticated table access.
alter table beta_signup_invites enable row level security;
alter table client_issue_reports enable row level security;
alter table listener_stream_attempts enable row level security;

alter table beta_signup_invites force row level security;
alter table client_issue_reports force row level security;
alter table listener_stream_attempts force row level security;

revoke all on table beta_signup_invites from anon, authenticated;
revoke all on table client_issue_reports from anon, authenticated;
revoke all on table listener_stream_attempts from anon, authenticated;

commit;
