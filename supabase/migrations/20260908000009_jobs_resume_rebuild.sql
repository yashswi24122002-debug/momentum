-- Replaces the Jobs tool's job-board/pipeline mechanic (scraped postings,
-- fit-score, application-stage tracking) with a JD-tailored resume +
-- cover letter + outreach tool. There's no more discovery feed to react
-- to — the user pastes a JD directly, so job_postings/applications and
-- the old resume-as-opaque-file-blob model are no longer needed.
drop table if exists outreach;
drop table if exists applications;
drop table if exists job_postings;
drop table if exists resumes;

-- One row per user: their resume as structured, editable data rather than
-- an opaque uploaded file. This is what makes "tailor without changing
-- format" possible at all — a fixed PDF template (lib/jobs/resume-pdf.ts)
-- always renders this same shape, so a tailored variant necessarily looks
-- like the original; only the words change.
create table resume_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade default auth.uid(),
  name text not null default '',
  email text,
  github text,
  mobile text,
  linkedin text,
  location text,
  education jsonb not null default '[]',   -- [{institution, detail, dates}]
  skills jsonb not null default '[]',      -- [{category, items: string[]}]
  experience jsonb not null default '[]',  -- [{company, location, role, dates, bullets: string[]}]
  projects jsonb not null default '[]',    -- [{name, description, dates}]
  honors jsonb not null default '[]',      -- string[]
  updated_at timestamptz default now()
);

alter table resume_profile enable row level security;
create policy "own rows" on resume_profile for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on resume_profile for select to authenticated
  using (is_admin(auth.uid()));

-- One row per JD you paste in — carries the whole flow (tailored resume
-- snapshot, cover letter, contact, outreach email) that used to be spread
-- across job_postings + outreach + applications.
create table job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  company text not null,
  role_title text not null,
  jd_text text not null,
  url text,
  status text not null default 'draft' check (status in ('draft', 'tailored', 'contact_found', 'sent', 'replied')),
  tailored_resume jsonb, -- same shape as resume_profile's content columns, snapshotted at tailor time
  cover_letter_text text,
  contact_email text,
  contact_name text,
  email_subject text,
  email_body_draft text,
  email_body_final text,
  resume_pdf_path text,        -- storage path in the "documents" bucket
  cover_letter_pdf_path text,  -- storage path in the "documents" bucket
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table job_applications enable row level security;
create policy "own rows" on job_applications for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on job_applications for select to authenticated
  using (is_admin(auth.uid()));

-- jobs_draft_outreach is kept (still the AI step that drafts the contact
-- email); jobs_tailor_application is new (the AI step that tailors the
-- resume + drafts the cover letter together in one call).
alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach', 'jobs_tailor_application'
));
