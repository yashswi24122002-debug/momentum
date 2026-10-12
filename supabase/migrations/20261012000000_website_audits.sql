-- Website audit reports for Local Leads — when a lead has an existing
-- website, runs a PageSpeed Insights check + a direct HTML scan + a Gemini
-- synthesis (text + the PSI screenshot) into a structured, attachable
-- report. One row per analysis run; re-analyzing inserts a new row rather
-- than overwriting, so a lead's audit history is preserved (e.g. to show
-- whether a prospect fixed something between a first and second pitch).
create table website_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  lead_id uuid not null references business_leads(id) on delete cascade,
  url text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  scores jsonb, -- {performance, seo, accessibility, best_practices} each 0-100
  core_web_vitals jsonb, -- {lcp_ms, cls, tbt_ms}
  screenshot_path text, -- storage path in the "documents" bucket
  issues jsonb, -- [{category, severity, title, detail}]
  cms_detected text,
  meta jsonb, -- {title, description, has_viewport, https_valid, has_sitemap, has_robots, response_ms}
  ai_summary text,
  report_pdf_path text, -- set once the client generates + uploads the PDF, for email attachment
  error text, -- set when status = 'failed'
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table website_audits enable row level security;
create policy "own rows" on website_audits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on website_audits for select to authenticated
  using (is_admin(auth.uid()));

create index website_audits_lead_id_idx on website_audits(lead_id, requested_at desc);

alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach', 'jobs_tailor_application',
  'leads_draft_pitch', 'leads_discover', 'leads_analyze_website'
));
