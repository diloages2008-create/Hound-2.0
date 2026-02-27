-- Worker spine enforcement and claim primitives
-- Date: 2026-02-27

alter table upload_assets
  add column if not exists storage_bucket text not null default 'hound-masters';

alter table transcode_jobs
  add column if not exists track_id uuid references tracks(track_id) on delete cascade,
  add column if not exists attempts int not null default 0,
  add column if not exists max_attempts int not null default 3,
  add column if not exists next_retry_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_transcode_jobs_claim
  on transcode_jobs(status, next_retry_at, created_at);

create or replace function claim_transcode_job(p_worker_id text)
returns table (
  job_id uuid,
  release_id uuid,
  track_id uuid,
  source_asset_id uuid,
  attempts int,
  max_attempts int
)
language plpgsql
as $$
begin
  return query
  with picked as (
    select t.job_id
    from transcode_jobs t
    where t.status in ('queued', 'failed')
      and t.attempts < t.max_attempts
      and coalesce(t.next_retry_at, now()) <= now()
    order by t.created_at asc
    limit 1
    for update skip locked
  ), updated as (
    update transcode_jobs t
    set status = 'in_progress',
        locked_by = p_worker_id,
        locked_at = now(),
        started_at = coalesce(t.started_at, now()),
        updated_at = now()
    where t.job_id in (select picked.job_id from picked)
    returning t.job_id, t.release_id, t.track_id, t.source_asset_id, t.attempts, t.max_attempts
  )
  select u.job_id, u.release_id, u.track_id, u.source_asset_id, u.attempts, u.max_attempts
  from updated u;
end;
$$;
