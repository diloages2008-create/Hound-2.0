-- Hound beta access schema
create table if not exists invites (
  code text primary key,
  createdAt timestamptz default now(),
  expiresAt timestamptz,
  maxDevices int default 1,
  usedCount int default 0,
  revoked boolean default false,
  note text
);

create table if not exists devices (
  deviceId text primary key,
  inviteCode text references invites(code),
  label text,
  firstSeen timestamptz default now(),
  lastSeen timestamptz default now(),
  revoked boolean default false,
  wipeOnNextLaunch boolean default false
);

create table if not exists sessions (
  token text primary key,
  deviceId text references devices(deviceId),
  createdAt timestamptz default now(),
  expiresAt timestamptz,
  revoked boolean default false
);

