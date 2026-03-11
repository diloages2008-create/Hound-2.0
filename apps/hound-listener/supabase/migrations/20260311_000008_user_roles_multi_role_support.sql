-- Multi-role support for single account identity
-- Date: 2026-03-11

begin;

create table if not exists user_roles (
  user_id uuid not null references app_users(user_id) on delete cascade,
  role text not null check (role in ('artist', 'listener', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists idx_user_roles_role_user
  on user_roles(role, user_id);

insert into user_roles (user_id, role)
select user_id, role
from app_users
where role in ('artist', 'listener', 'admin')
on conflict (user_id, role) do nothing;

alter table user_roles enable row level security;
alter table user_roles force row level security;
revoke all on table user_roles from anon, authenticated;

commit;
