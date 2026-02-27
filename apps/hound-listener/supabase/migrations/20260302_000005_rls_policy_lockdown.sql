-- v0.2 RLS lockdown
-- Date: 2026-03-02

begin;

-- Enable + force RLS on all public application tables
alter table app_users enable row level security;
alter table artist_profiles enable row level security;
alter table artist_rights_attestations enable row level security;
alter table releases enable row level security;
alter table tracks enable row level security;
alter table track_credits enable row level security;
alter table upload_assets enable row level security;
alter table transcode_jobs enable row level security;
alter table listener_play_events enable row level security;
alter table listener_event_log enable row level security;
alter table listener_track_saves enable row level security;
alter table album_similarity_edges enable row level security;

alter table app_users force row level security;
alter table artist_profiles force row level security;
alter table artist_rights_attestations force row level security;
alter table releases force row level security;
alter table tracks force row level security;
alter table track_credits force row level security;
alter table upload_assets force row level security;
alter table transcode_jobs force row level security;
alter table listener_play_events force row level security;
alter table listener_event_log force row level security;
alter table listener_track_saves force row level security;
alter table album_similarity_edges force row level security;

-- Reset broad table grants for anon/authenticated and re-grant minimal access.
revoke all on table app_users from anon, authenticated;
revoke all on table artist_profiles from anon, authenticated;
revoke all on table artist_rights_attestations from anon, authenticated;
revoke all on table releases from anon, authenticated;
revoke all on table tracks from anon, authenticated;
revoke all on table track_credits from anon, authenticated;
revoke all on table upload_assets from anon, authenticated;
revoke all on table transcode_jobs from anon, authenticated;
revoke all on table listener_play_events from anon, authenticated;
revoke all on table listener_event_log from anon, authenticated;
revoke all on table listener_track_saves from anon, authenticated;
revoke all on table album_similarity_edges from anon, authenticated;

grant select on table releases to anon, authenticated;
grant select on table tracks to anon, authenticated;
grant select on table track_credits to anon, authenticated;

grant select on table app_users to authenticated;
grant select, insert, update on table artist_profiles to authenticated;
grant select, insert on table artist_rights_attestations to authenticated;
grant select, insert, update, delete on table releases to authenticated;
grant select, insert, update, delete on table tracks to authenticated;
grant select, insert, update, delete on table track_credits to authenticated;
grant select, insert, update, delete on table upload_assets to authenticated;
grant insert on table listener_play_events to authenticated;
grant insert on table listener_event_log to authenticated;
grant select, insert, update, delete on table listener_track_saves to authenticated;

-- Idempotent policy rebuild
drop policy if exists app_users_select_own on app_users;
drop policy if exists artist_profiles_select_own on artist_profiles;
drop policy if exists artist_profiles_insert_own on artist_profiles;
drop policy if exists artist_profiles_update_own on artist_profiles;
drop policy if exists artist_rights_select_own on artist_rights_attestations;
drop policy if exists artist_rights_insert_own on artist_rights_attestations;
drop policy if exists releases_select_live_or_owner on releases;
drop policy if exists releases_insert_owner_draft on releases;
drop policy if exists releases_update_owner_non_live on releases;
drop policy if exists releases_delete_owner_draft on releases;
drop policy if exists tracks_select_live_or_owner on tracks;
drop policy if exists tracks_insert_owner_only on tracks;
drop policy if exists tracks_update_owner_only on tracks;
drop policy if exists tracks_delete_owner_only on tracks;
drop policy if exists track_credits_select_live_or_owner on track_credits;
drop policy if exists track_credits_insert_owner_only on track_credits;
drop policy if exists track_credits_update_owner_only on track_credits;
drop policy if exists track_credits_delete_owner_only on track_credits;
drop policy if exists upload_assets_select_owner on upload_assets;
drop policy if exists upload_assets_insert_owner_artist_assets on upload_assets;
drop policy if exists upload_assets_update_owner_artist_assets on upload_assets;
drop policy if exists upload_assets_delete_owner_artist_assets on upload_assets;
drop policy if exists listener_play_events_insert_own on listener_play_events;
drop policy if exists listener_event_log_insert_own on listener_event_log;
drop policy if exists listener_track_saves_select_own on listener_track_saves;
drop policy if exists listener_track_saves_insert_own on listener_track_saves;
drop policy if exists listener_track_saves_update_own on listener_track_saves;
drop policy if exists listener_track_saves_delete_own on listener_track_saves;

-- app_users: owner-only read
create policy app_users_select_own
  on app_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- artist_profiles: owner-only
create policy artist_profiles_select_own
  on artist_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy artist_profiles_insert_own
  on artist_profiles
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and onboarding_status = 'pending'
  );

create policy artist_profiles_update_own
  on artist_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and onboarding_status = 'pending'
  );

-- rights attestations: only for caller-owned artist profile
create policy artist_rights_select_own
  on artist_rights_attestations
  for select
  to authenticated
  using (
    exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = artist_rights_attestations.artist_id
        and ap.user_id = auth.uid()
    )
  );

create policy artist_rights_insert_own
  on artist_rights_attestations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = artist_rights_attestations.artist_id
        and ap.user_id = auth.uid()
    )
  );

-- releases: public read only when live, owner can read/manage own non-live
create policy releases_select_live_or_owner
  on releases
  for select
  to anon, authenticated
  using (
    status = 'live'
    or exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = releases.artist_id
        and ap.user_id = auth.uid()
    )
  );

create policy releases_insert_owner_draft
  on releases
  for insert
  to authenticated
  with check (
    status = 'draft'
    and exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = releases.artist_id
        and ap.user_id = auth.uid()
    )
  );

create policy releases_update_owner_non_live
  on releases
  for update
  to authenticated
  using (
    exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = releases.artist_id
        and ap.user_id = auth.uid()
    )
  )
  with check (
    status in ('draft', 'submitted', 'in_transcode', 'rejected')
    and exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = releases.artist_id
        and ap.user_id = auth.uid()
    )
  );

create policy releases_delete_owner_draft
  on releases
  for delete
  to authenticated
  using (
    status = 'draft'
    and exists (
      select 1
      from artist_profiles ap
      where ap.artist_id = releases.artist_id
        and ap.user_id = auth.uid()
    )
  );

-- tracks: public read only for live releases, owner-only write
create policy tracks_select_live_or_owner
  on tracks
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from releases r
      join artist_profiles ap on ap.artist_id = r.artist_id
      where r.release_id = tracks.release_id
        and (r.status = 'live' or ap.user_id = auth.uid())
    )
  );

create policy tracks_insert_owner_only
  on tracks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from releases r
      join artist_profiles ap on ap.artist_id = r.artist_id
      where r.release_id = tracks.release_id
        and ap.user_id = auth.uid()
    )
  );

create policy tracks_update_owner_only
  on tracks
  for update
  to authenticated
  using (
    exists (
      select 1
      from releases r
      join artist_profiles ap on ap.artist_id = r.artist_id
      where r.release_id = tracks.release_id
        and ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from releases r
      join artist_profiles ap on ap.artist_id = r.artist_id
      where r.release_id = tracks.release_id
        and ap.user_id = auth.uid()
    )
  );

create policy tracks_delete_owner_only
  on tracks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from releases r
      join artist_profiles ap on ap.artist_id = r.artist_id
      where r.release_id = tracks.release_id
        and ap.user_id = auth.uid()
    )
  );

-- credits: public read only for live releases, owner-only write
create policy track_credits_select_live_or_owner
  on track_credits
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from tracks t
      join releases r on r.release_id = t.release_id
      join artist_profiles ap on ap.artist_id = r.artist_id
      where t.track_id = track_credits.track_id
        and (r.status = 'live' or ap.user_id = auth.uid())
    )
  );

create policy track_credits_insert_owner_only
  on track_credits
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from tracks t
      join releases r on r.release_id = t.release_id
      join artist_profiles ap on ap.artist_id = r.artist_id
      where t.track_id = track_credits.track_id
        and ap.user_id = auth.uid()
    )
  );

create policy track_credits_update_owner_only
  on track_credits
  for update
  to authenticated
  using (
    exists (
      select 1
      from tracks t
      join releases r on r.release_id = t.release_id
      join artist_profiles ap on ap.artist_id = r.artist_id
      where t.track_id = track_credits.track_id
        and ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from tracks t
      join releases r on r.release_id = t.release_id
      join artist_profiles ap on ap.artist_id = r.artist_id
      where t.track_id = track_credits.track_id
        and ap.user_id = auth.uid()
    )
  );

create policy track_credits_delete_owner_only
  on track_credits
  for delete
  to authenticated
  using (
    exists (
      select 1
      from tracks t
      join releases r on r.release_id = t.release_id
      join artist_profiles ap on ap.artist_id = r.artist_id
      where t.track_id = track_credits.track_id
        and ap.user_id = auth.uid()
    )
  );

-- assets: owner-only; client can only operate on artist-upload asset kinds
create policy upload_assets_select_owner
  on upload_assets
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy upload_assets_insert_owner_artist_assets
  on upload_assets
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and kind in ('master_audio', 'cover_art')
  );

create policy upload_assets_update_owner_artist_assets
  on upload_assets
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    and kind in ('master_audio', 'cover_art')
  )
  with check (
    owner_user_id = auth.uid()
    and kind in ('master_audio', 'cover_art')
    and status in ('pending', 'uploaded', 'failed')
  );

create policy upload_assets_delete_owner_artist_assets
  on upload_assets
  for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    and kind in ('master_audio', 'cover_art')
  );

-- transcode_jobs: worker-only (service role only) via no anon/authenticated grants and no policies.
-- album_similarity_edges: worker-only (service role only) via no anon/authenticated grants and no policies.

-- telemetry: insert-only
create policy listener_play_events_insert_own
  on listener_play_events
  for insert
  to authenticated
  with check (listener_user_id = auth.uid());

create policy listener_event_log_insert_own
  on listener_event_log
  for insert
  to authenticated
  with check (listener_user_id = auth.uid());

-- listener saves: owner-only
create policy listener_track_saves_select_own
  on listener_track_saves
  for select
  to authenticated
  using (listener_user_id = auth.uid());

create policy listener_track_saves_insert_own
  on listener_track_saves
  for insert
  to authenticated
  with check (listener_user_id = auth.uid());

create policy listener_track_saves_update_own
  on listener_track_saves
  for update
  to authenticated
  using (listener_user_id = auth.uid())
  with check (listener_user_id = auth.uid());

create policy listener_track_saves_delete_own
  on listener_track_saves
  for delete
  to authenticated
  using (listener_user_id = auth.uid());

commit;
