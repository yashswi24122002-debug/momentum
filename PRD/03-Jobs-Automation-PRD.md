# Jobs Automation Tool — PRD

## 1. Purpose
Aggregate real tech job postings from compliant sources, match them to your profile, and support cold-email outreach with AI-personalized (human-reviewed) drafts, plus a lightweight application pipeline tracker. Explicitly avoids scraping LinkedIn or violating any platform ToS — see Master PRD Non-Goals.

## 2. User Flow

**Aggregation (automated, daily):**
1. Vercel Cron triggers `/api/cron/aggregate-jobs` once daily
2. Pulls from Greenhouse/Lever public job board APIs, RemoteOK, Adzuna — filtered by role keywords/tech stack/location config
3. De-dupes against existing `job_postings`, inserts new ones with `status = 'new'`

**Review & Match:**
4. User browses `/jobs` — new postings shown, sorted by fit_score (simple keyword match against profile/resume keywords)
5. User marks `reviewed` or `dismissed` per posting

**Cold Email (review-queue workflow):**
6. For a reviewed posting, user clicks **"Draft Outreach"**
7. System calls Hunter.io for likely contact email at the company domain (nullable if none found — falls back to posting's listed contact if present)
8. Gemini drafts a personalized email (1-2 sentences referencing the specific posting) using a base template + selected resume
9. Draft appears in the **Review Queue** — user edits subject/body freely
10. User clicks **Approve** → sets `scheduled_send_at` (paced: a few per hour during work hours, not all at once)
11. Cron job `/api/cron/send-scheduled-emails` sends anything due via Resend
12. Manually mark `replied` when a response comes in

**Direct Apply:**
13. If posting has a direct apply URL, show an "Apply on site ↗" button (opens external link) — no in-app form automation

**Application Tracking:**
14. Every outreach or applied posting gets an `applications` row with stage: `Discovered → Reviewing → Applied/Emailed → Response → Interview → Offer/Rejected`

## 3. Data Sources

| Source | Endpoint pattern | Auth | Coverage |
|---|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{company}/jobs` | None | Funded startups/scaleups using Greenhouse ATS |
| Lever | `api.lever.co/v0/postings/{company}` | None | Companies using Lever ATS |
| RemoteOK | `remoteok.com/api` | None | Remote-first tech roles |
| Remotive | `remotive.com/api/remote-jobs` | None | Remote tech roles, different company coverage than RemoteOK |
| Arbeitnow | `arbeitnow.com/api/job-board-api` | None | German/EU tech jobs — useful overlap with Masters Abroad relocation plans |
| Adzuna | `api.adzuna.com/v1/api/jobs/{country}/search/1` | `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Broadest general job aggregator |
| Jooble | `jooble.org/api/{JOOBLE_API_KEY}` | `JOOBLE_API_KEY` | Broad aggregator, different indexing than Adzuna |
| Hunter.io | `api.hunter.io/v2/domain-search` | `HUNTER_API_KEY` | Contact email discovery (not a job source itself) |

Since Greenhouse and Lever require a per-company board slug (there's no single "search all companies" endpoint), maintain a config list of target companies you care about (`lib/integrations/greenhouse-companies.ts`, `lib/integrations/lever-companies.ts`) that the aggregation cron iterates through — start with a handful of companies you're interested in and expand the list over time.

## 4. AI Prompt Contract (Email Draft)

**Input:** job posting description + resume summary + contact name (if known)
**Output (strict JSON):**
```json
{
  "subject": "string",
  "body": "string (includes 1-2 sentences specific to this posting/company)"
}
```

## 5. Data Model

```sql
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
```

## 6. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/cron/aggregate-jobs` | GET | Daily cron — pull + de-dupe postings, protected by `CRON_SECRET` |
| `/api/jobs` | GET | List postings, filterable by status/fit_score |
| `/api/jobs/[id]/dismiss` | POST | Mark dismissed |
| `/api/jobs/[id]/draft-outreach` | POST | Hunter.io lookup + Gemini draft → creates `outreach` row |
| `/api/outreach/[id]` | PATCH | Edit draft, approve, set schedule |
| `/api/cron/send-scheduled-emails` | GET | Daily/hourly cron — sends due emails via Resend, protected by `CRON_SECRET` |
| `/api/applications` | GET/POST/PATCH | Pipeline tracker CRUD |

## 7. UI Pages
- `/jobs` — new/reviewed postings feed, filter by fit_score, dismiss/review actions
- `/jobs/outreach-queue` — review queue: edit-before-send list of drafts
- `/jobs/pipeline` — kanban board of `applications` by stage

## 8. Acceptance Criteria
- No email ever sends without explicit `approved` status set by the user
- Scheduled sends are paced (not all fired at the same timestamp) — cron checks a due window and sends in small batches spread over the day
- A failed source in aggregation (e.g., Adzuna quota exceeded) does not block other sources from being aggregated
- Duplicate postings (same company + role_title + source overlap) are not inserted twice
