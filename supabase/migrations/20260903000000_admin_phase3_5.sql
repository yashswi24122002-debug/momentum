-- Admin & Multi-User Access Control Phases 3-5 (09-Admin-Access-Control-
-- PRD.md §6, §8, §9): user management, per-tool access, usage caps, and
-- per-user Gemini keys.

create table tool_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tool_key text not null check (tool_key in ('habits','ideas','content','masters_abroad','jobs','calories')),
  enabled boolean not null default false,
  updated_at timestamptz default now(),
  unique(user_id, tool_key)
);
alter table tool_access enable row level security;
-- Members can read their own rows (drives their own nav filtering); only
-- the admin can create/update/delete any row (including their own — not
-- that it matters, since the admin bypasses tool_access checks entirely
-- in application code regardless of what's stored here).
create policy "member reads own" on tool_access for select to authenticated using (auth.uid() = user_id or is_admin(auth.uid()));
create policy "admin writes" on tool_access for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- One Gemini key per member, entered by the admin. admin-only, full stop —
-- no policy grants a member any access to this table, not even their own
-- row; api_key_encrypted is application-level AES-256-GCM (lib/admin/
-- crypto.ts, keyed by API_KEY_ENCRYPTION_SECRET — never in Supabase),
-- decrypted only server-side at the moment a Gemini call is made.
create table user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'gemini' check (provider in ('gemini')),
  api_key_encrypted text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);
alter table user_api_keys enable row level security;
create policy "admin only" on user_api_keys for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Per-member, per-AI-feature daily cap. daily_limit null = unlimited.
create table usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  feature_key text not null check (feature_key in (
    'ideas_generate', 'content_generate', 'masters_discover',
    'calories_analyse_photo', 'jobs_draft_outreach'
  )),
  daily_limit int,
  updated_at timestamptz default now(),
  unique(user_id, feature_key)
);
alter table usage_limits enable row level security;
create policy "member reads own" on usage_limits for select to authenticated using (auth.uid() = user_id or is_admin(auth.uid()));
create policy "admin writes" on usage_limits for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Actual usage, keyed by local calendar date — "daily" reset is automatic,
-- no cron needed. Incremented by the calling user's own session (never
-- service-role), so a plain own-row policy is enough — no admin-only
-- write restriction needed here the way there is for limits/keys.
create table usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  feature_key text not null,
  usage_date date not null,
  count int not null default 0,
  unique(user_id, feature_key, usage_date)
);
alter table usage_counters enable row level security;
create policy "own rows" on usage_counters for all to authenticated
  using (auth.uid() = user_id or is_admin(auth.uid()))
  with check (auth.uid() = user_id);
