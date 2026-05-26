-- HOUND DEN reports/incident workflow expansion
-- Date: 2026-03-11

begin;

alter table client_issue_reports
  add column if not exists incident_status text not null default 'new'
    check (incident_status in ('new', 'triaged', 'investigating', 'escalated', 'resolved', 'dismissed')),
  add column if not exists incident_severity text not null default 'medium'
    check (incident_severity in ('low', 'medium', 'high', 'critical')),
  add column if not exists incident_assignee_user_id uuid references app_users(user_id) on delete set null,
  add column if not exists incident_reason text,
  add column if not exists incident_resolution_notes text,
  add column if not exists incident_resolved_at timestamptz,
  add column if not exists incident_last_action_at timestamptz not null default now(),
  add column if not exists incident_action_history jsonb not null default '[]'::jsonb;

create index if not exists idx_client_issue_reports_incident_status_created
  on client_issue_reports(incident_status, created_at desc);

create index if not exists idx_client_issue_reports_incident_severity_created
  on client_issue_reports(incident_severity, created_at desc);

create index if not exists idx_client_issue_reports_incident_assignee
  on client_issue_reports(incident_assignee_user_id, created_at desc);

update client_issue_reports
set incident_status = 'new'
where incident_status is null;

update client_issue_reports
set incident_severity = 'medium'
where incident_severity is null;

update client_issue_reports
set incident_last_action_at = coalesce(incident_last_action_at, created_at, now());

commit;
