-- Hound canonical backend schema v1 (Postgres / Supabase)
-- Date: 2026-02-24

create extension if not exists pgcrypto;

-- Identity
create table if not exists app_users (
  user_id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('artist', 'listener', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists artist_profiles (
  artist_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users(user_id) on delete cascade,
  stage_name text not null,
  bio text not null default '',
  influences text[] not null default '{}',
  credits text[] not null default '{}',
  socials jsonb not null default '{}'::jsonb,
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artist_rights_attestations (
  attestation_id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artist_profiles(artist_id) on delete cascade,
  owns_masters boolean not null,
  rights_statement text,
  attested_at timestamptz not null default now()
);

-- Catalog
create table if not exists releases (
  release_id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artist_profiles(artist_id) on delete cascade,
  title text not null,
  release_type text not null check (release_type in ('album', 'ep', 'single')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'in_transcode', 'live', 'rejected')),
  genre text not null,
  mood_tags text[] not null default '{}',
  about text not null default '',
  release_date date,
  cover_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracks (
  track_id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(release_id) on delete cascade,
  title text not null,
  track_number int not null check (track_number > 0),
  duration_sec int,
  lyrics text,
  stream_manifest_path text,
  master_asset_id uuid,
  created_at timestamptz not null default now(),
  unique (release_id, track_number)
);

create table if not exists track_credits (
  track_credit_id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(track_id) on delete cascade,
  person_name text not null,
  role text not null,
  sort_order int not null default 0
);

-- Assets and pipeline
create table if not exists upload_assets (
  asset_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(user_id) on delete cascade,
  kind text not null check (kind in ('master_audio', 'cover_art', 'hls_manifest', 'hls_segment')),
  storage_path text not null,
  content_type text not null,
  byte_size bigint,
  checksum_sha256 text,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'processed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists transcode_jobs (
  job_id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(release_id) on delete cascade,
  source_asset_id uuid not null references upload_assets(asset_id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table releases
  add constraint if not exists releases_cover_asset_fk
  foreign key (cover_asset_id) references upload_assets(asset_id) on delete set null;

alter table tracks
  add constraint if not exists tracks_master_asset_fk
  foreign key (master_asset_id) references upload_assets(asset_id) on delete set null;

-- Listener telemetry and recommendation inputs
create table if not exists listener_play_events (
  event_id uuid primary key default gen_random_uuid(),
  listener_user_id uuid not null references app_users(user_id) on delete cascade,
  track_id uuid not null references tracks(track_id) on delete cascade,
  play_start_time timestamptz not null,
  play_end_time timestamptz not null,
  percent_listened numeric(5,2) not null check (percent_listened >= 0 and percent_listened <= 100),
  skipped_early boolean not null,
  replayed_same_session int not null default 0,
  completed_play boolean not null default false,
  manual_skip boolean not null default false,
  auto_advance boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists album_similarity_edges (
  edge_id uuid primary key default gen_random_uuid(),
  source_release_id uuid not null references releases(release_id) on delete cascade,
  target_release_id uuid not null references releases(release_id) on delete cascade,
  score numeric(7,4) not null,
  reason text not null,
  updated_at timestamptz not null default now(),
  unique (source_release_id, target_release_id)
);

-- Useful indexes
create index if not exists idx_releases_artist_status on releases(artist_id, status);
create index if not exists idx_tracks_release on tracks(release_id, track_number);
create index if not exists idx_play_events_listener_time on listener_play_events(listener_user_id, play_start_time desc);
create index if not exists idx_play_events_track_time on listener_play_events(track_id, play_start_time desc);
create index if not exists idx_similarity_source_score on album_similarity_edges(source_release_id, score desc);
