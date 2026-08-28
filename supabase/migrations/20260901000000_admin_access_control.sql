-- Admin & Multi-User Access Control (09-Admin-Access-Control-PRD.md) —
-- Phase 1: roles + admin shell only. No data-isolation, tool_access,
-- usage_limits, or user_api_keys yet — those are later phases in the PRD.

create type user_role as enum ('admin', 'member');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'member',
  must_change_password boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PRD §4: admin status requires BOTH this role column AND a match against
-- the fixed ADMIN_EMAIL env var, checked together in lib/supabase/
-- admin-guard.ts — this function is the DB-side half of that check, used
-- inside RLS policies where the app can't inject an env var.
create or replace function is_admin(uid uuid) returns boolean as $$
  select exists(select 1 from profiles where id = uid and role = 'admin');
$$ language sql security definer stable;

alter table profiles enable row level security;

create policy "members read own profile" on profiles for select to authenticated
  using (auth.uid() = id or is_admin(auth.uid()));
create policy "members update own display name" on profiles for update to authenticated
  using (auth.uid() = id or is_admin(auth.uid()))
  with check (auth.uid() = id or is_admin(auth.uid()));

-- Backfill: the single existing Supabase Auth account becomes admin.
insert into profiles (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'yashswi24122002@gmail.com'
on conflict (id) do update set role = 'admin';
