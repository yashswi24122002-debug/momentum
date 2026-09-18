-- Local Leads tool (09-Local-Leads-PRD.md): sources small-business leads
-- via Google Places, prioritizes businesses with no website, and supports
-- email cold outreach through the same review-before-send discipline as
-- Jobs Automation. Per-user (own rows), not a shared global catalog like
-- job_postings was — the PRD's schema didn't have a user_id at all
-- (written before this app went multi-user), so google_place_id is
-- de-duped per user rather than globally: two members could plausibly
-- both discover the same real business independently.
create table business_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  name text not null,
  category text,
  address text,
  area text check (area in ('noida', 'ghaziabad', 'greater_noida', 'other')),
  phone text,
  email text,
  existing_website text,
  google_rating float8,
  google_place_id text not null,
  source text default 'google_places',
  discovered_at timestamptz default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'proposal_sent', 'won', 'lost')),
  unique (user_id, google_place_id)
);

alter table business_leads enable row level security;
create policy "own rows" on business_leads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on business_leads for select to authenticated
  using (is_admin(auth.uid()));

create table lead_outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  lead_id uuid not null references business_leads(id) on delete cascade,
  pitch_subject text,
  pitch_body_draft text,
  pitch_body_final text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'responded')),
  sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table lead_outreach enable row level security;
create policy "own rows" on lead_outreach for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on lead_outreach for select to authenticated
  using (is_admin(auth.uid()));

-- Register the new tool + its one AI feature.
alter table tool_access drop constraint tool_access_tool_key_check;
alter table tool_access add constraint tool_access_tool_key_check check (tool_key in (
  'habits', 'ideas', 'content', 'masters_abroad', 'jobs', 'calories', 'local_leads'
));

alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach', 'jobs_tailor_application',
  'leads_draft_pitch'
));
