-- Momentum — initial schema
-- One migration covering all 5 tools, per Master PRD §4/§7 build phasing.
-- Table shapes are copied verbatim from each tool's PRD §5/§4 data model.

create extension if not exists pgcrypto;

-- ============================================================
-- Habit Tracker (04-Habit-Tracker-PRD.md §3)
-- ============================================================

create table habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  active boolean default true,
  archived_at timestamptz,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  logged_at timestamptz default now(),
  unique (habit_id, date)
);

create table weekly_todos (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null unique,
  top_priority text,
  top_3_tasks jsonb default '[]' -- [{ "text": "string", "done": boolean }]
);

-- ============================================================
-- Ideas Tool (01-Ideas-Tool-PRD.md §5)
-- ============================================================

create table ideas (
  id uuid primary key default gen_random_uuid(),
  date_generated date not null,
  title text not null,
  one_liner text not null,
  category text not null,
  effort_estimate text check (effort_estimate in ('S','M','L')),
  status text check (status in ('pending','approved','rejected')) default 'pending',
  rejection_reason text,
  source_signals jsonb,
  created_at timestamptz default now()
);

create table idea_reports (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas(id) on delete cascade,
  scope text,
  target_audience text,
  plan text,
  reliability_doability text,
  next_action text,
  competitive_landscape text,
  cost_estimate text,
  effort_impact_score int,
  lifecycle_status text check (lifecycle_status in ('backlog','researching','building','shipped','abandoned')) default 'backlog',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Masters Abroad Tool (02-Masters-Abroad-PRD.md §4)
-- ============================================================

create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_name text,
  city text,
  intake_target text,
  deadline_uni_assist date,
  deadline_direct date,
  requirements jsonb,
  source text check (source in ('manual','ai_suggested')) default 'manual',
  verified boolean default false,
  status text check (status in ('researching','shortlisted','applying','applied','decision')) default 'researching',
  fit_notes text,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text check (category in ('documents','exams','financial','visa','application','language')),
  depends_on uuid[] default '{}',
  status text check (status in ('not_started','in_progress','blocked','done')) default 'not_started',
  deadline date,
  university_id uuid references universities(id) on delete cascade,
  instructions text,
  where_to_apply_url text,
  reminder_sent_30 boolean default false,
  reminder_sent_14 boolean default false,
  reminder_sent_7 boolean default false,
  reminder_sent_1 boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  task_id uuid references tasks(id) on delete set null,
  university_id uuid references universities(id) on delete set null,
  version int default 1,
  uploaded_at timestamptz default now()
);

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  sent_at timestamptz default now(),
  days_before int
);

-- ============================================================
-- Jobs Automation (03-Jobs-Automation-PRD.md §5)
-- ============================================================

create table job_postings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  company text not null,
  role_title text not null,
  location text,
  remote boolean default false,
  url text,
  description_raw text,
  tech_stack_tags text[],
  posted_date date,
  discovered_at timestamptz default now(),
  fit_score int,
  status text check (status in ('new','reviewed','dismissed')) default 'new'
);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  focus_area text
);

create table outreach (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid references job_postings(id) on delete cascade,
  contact_email text,
  contact_name text,
  resume_id uuid references resumes(id),
  email_subject text,
  email_body_draft text,
  email_body_final text,
  status text check (status in ('draft','approved','scheduled','sent','replied')) default 'draft',
  scheduled_send_at timestamptz,
  sent_at timestamptz,
  follow_up_due date
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid references job_postings(id) on delete cascade,
  stage text check (stage in ('discovered','reviewing','applied_emailed','response','interview','offer','rejected')) default 'discovered',
  applied_via text check (applied_via in ('email','portal')),
  notes text,
  next_action text,
  next_action_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Content Creation (05-Content-Creation-PRD.md §6)
-- ============================================================

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  location_summary text
);

create table media (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  thumbnail_url text,
  taken_at timestamptz,
  location_lat float8,
  location_lng float8,
  location_name text,
  trip_id uuid references trips(id) on delete set null,
  tags text[],
  content_worthy boolean default false,
  rating int,
  uploaded_at timestamptz default now()
);

create table content_ideas (
  id uuid primary key default gen_random_uuid(),
  date_generated date not null,
  title text not null,
  format text check (format in ('reel','carousel')),
  trend_source text,
  trend_signal text,
  matched_media_ids uuid[] default '{}',
  status text check (status in ('pending','approved','rejected')) default 'pending',
  rejection_reason text,
  created_at timestamptz default now()
);

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  content_idea_id uuid references content_ideas(id) on delete cascade,
  concept_format text,
  why_trending text,
  assets_available text,
  assets_needed text,
  caption_draft text,
  hashtags text[],
  best_posting_window text,
  next_action text,
  lifecycle_status text check (lifecycle_status in ('backlog','shooting_editing','ready','posted')) default 'backlog',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Cross-cutting (00-Master-PRD.md §6 — error handling)
-- ============================================================

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- e.g. 'integrations/hunter', 'cron/aggregate-jobs'
  message text not null,
  context jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
--
-- Momentum is single-user (Master PRD §6: one manually-created Supabase Auth
-- account, no public sign-up). The anon key ships to the browser, so every
-- table needs RLS or PostgREST would let anyone with that key query the
-- database directly. Policy: any authenticated session (there is only ever
-- one) gets full access; anonymous requests get none. Service-role calls
-- (cron routes, via lib/supabase/admin.ts) bypass RLS entirely.
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'habits', 'habit_logs', 'weekly_todos',
      'ideas', 'idea_reports',
      'universities', 'tasks', 'documents', 'reminder_log',
      'job_postings', 'resumes', 'outreach', 'applications',
      'trips', 'media', 'content_ideas', 'content_reports',
      'error_logs'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
