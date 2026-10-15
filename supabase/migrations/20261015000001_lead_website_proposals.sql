-- For leads with NO existing website, there's nothing to audit — this is
-- the forward-looking equivalent of website_audits: a short, AI-drafted
-- proposal (why a website, what pages/sections make sense for this
-- specific business category) rendered into a PDF client-side and
-- attached to the outreach email the same way an audit report is.
create table lead_website_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  lead_id uuid not null references business_leads(id) on delete cascade,
  why text,
  suggested_pages jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);

alter table lead_website_proposals enable row level security;
create policy "own rows" on lead_website_proposals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on lead_website_proposals for select to authenticated
  using (is_admin(auth.uid()));

create index lead_website_proposals_lead_id_idx on lead_website_proposals(lead_id, created_at desc);

alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach', 'jobs_tailor_application',
  'leads_draft_pitch', 'leads_discover', 'leads_analyze_website', 'leads_draft_proposal'
));
