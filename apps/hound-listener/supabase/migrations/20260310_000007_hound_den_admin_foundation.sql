-- HOUND DEN admin foundation: RBAC metadata, audit log, moderation queue, richer incident payloads
-- Date: 2026-03-10

begin;

alter table app_users
  add column if not exists admin_scope text
    check (admin_scope in ('super_admin', 'ops_admin', 'content_admin', 'support_viewer')),
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  add column if not exists mfa_enrolled boolean not null default false,
  add column if not exists last_active_at timestamptz;

create index if not exists idx_app_users_role_admin_scope
  on app_users(role, admin_scope);

create table if not exists admin_audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references app_users(user_id) on delete restrict,
  actor_admin_scope text,
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_events_created_at
  on admin_audit_events(created_at desc);

create index if not exists idx_admin_audit_events_actor
  on admin_audit_events(actor_user_id, created_at desc);

create table if not exists moderation_flags (
  flag_id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('artist', 'release', 'track', 'user')),
  target_id uuid,
  source_report_id uuid references client_issue_reports(report_id) on delete set null,
  category text not null default 'other'
    check (category in ('abuse', 'explicit', 'copyright', 'quality', 'security', 'other')),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'escalated', 'resolved', 'dismissed')),
  notes text,
  created_by_user_id uuid references app_users(user_id) on delete set null,
  assigned_admin_user_id uuid references app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_moderation_flags_status_created
  on moderation_flags(status, created_at desc);

alter table releases
  add column if not exists is_hidden boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists priority_rank int not null default 0,
  add column if not exists moderation_notes text,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists idx_releases_status_hidden_priority
  on releases(status, is_hidden, priority_rank desc, updated_at desc);

alter table client_issue_reports
  add column if not exists account_type text,
  add column if not exists platform text,
  add column if not exists app_version text,
  add column if not exists environment text,
  add column if not exists device_info jsonb not null default '{}'::jsonb,
  add column if not exists network_state jsonb not null default '{}'::jsonb,
  add column if not exists report_category text,
  add column if not exists user_description text,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists stack_trace text,
  add column if not exists failed_request_url text,
  add column if not exists response_status int,
  add column if not exists worker_job_id uuid references transcode_jobs(job_id) on delete set null,
  add column if not exists release_id uuid references releases(release_id) on delete set null,
  add column if not exists track_id uuid references tracks(track_id) on delete set null,
  add column if not exists artist_id uuid references artist_profiles(artist_id) on delete set null,
  add column if not exists playback_session_id text;

create index if not exists idx_client_issue_reports_category_created
  on client_issue_reports(report_category, created_at desc);

create index if not exists idx_client_issue_reports_release_track
  on client_issue_reports(release_id, track_id, created_at desc);

commit;
