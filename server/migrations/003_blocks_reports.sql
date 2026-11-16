-- Blocking: once either person has blocked the other, they can't message each
-- other and don't see each other on the Study now board.
create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);

-- Reports for whoever runs the site to read. The email is copied in so a
-- report still means something after the reported account is deleted.
create table reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references users(id) on delete set null,
  reported_id    uuid references users(id) on delete set null,
  reported_email text not null,
  reason         text not null check (length(reason) between 1 and 1000),
  created_at     timestamptz not null default now()
);
