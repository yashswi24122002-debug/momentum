# Masters Abroad Tool — PRD

## 1. Purpose
A dependency-aware checklist and tracker to manage the full application process for an MS in Cybersecurity in Germany (Winter intake), covering documents, deadlines, university shortlist/discovery, and reminders — a "do the right thing at the right time" system, not passive information.

## 2. User Flow

**Setup (one-time):**
1. On first use, seed the default task template (transcripts, APS certificate, IELTS/TOEFL, SOP, LORs, CV, blocked account, uni-assist, visa appointment, health insurance)
2. User inputs profile (GPA, work-ex, budget, specialization interest e.g. offensive security / security management / applied crypto, city preference)

**University Discovery:**
3. User clicks **"Discover Universities"** → Gemini generates candidate German universities with cybersecurity-relevant MS programs + reasoning
4. Each suggestion lands with `source: ai_suggested`, `verified: false`
5. User reviews → moves to `shortlisted` (with a required manual "✅ Verified against official site" check before any deadline from it is trusted) or discards

**Ongoing use:**
6. Tasks view: dependency-aware checklist, grouped by category (Documents / Exams / Financial / Visa / Application / Language), some tasks universal, some scoped to a specific university
7. Mark tasks complete; blocked tasks (unmet dependency) are visually disabled until prerequisite is done
8. Timeline/calendar view aggregates all deadlines (uni-assist deadlines, university deadlines, exam dates, visa appointment) in one visual
9. **Daily cron job** (Vercel Cron) checks all upcoming deadlines → sends email via Resend at 30/14/7/1 days before, once per threshold (no duplicates)

## 3. AI Prompt Contract (University Discovery)

**Input:** user profile object (GPA, work experience, budget, specialization, city preference)
**Output (strict JSON array):**
```json
[
  {
    "name": "string",
    "program_name": "string",
    "city": "string",
    "reasoning": "string",
    "estimated_requirements": "string (flagged as unverified)"
  }
]
```

## 4. Data Model

```sql
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
```

## 5. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/universities` | GET/POST | List / add universities |
| `/api/universities/discover` | POST | AI-generate candidate universities from profile |
| `/api/universities/[id]` | PATCH | Update status/verified/deadlines |
| `/api/tasks` | GET/POST | List / create tasks (supports default template seeding) |
| `/api/tasks/[id]` | PATCH | Update status, mark complete |
| `/api/documents` | POST | Upload document (Supabase Storage) |
| `/api/cron/deadline-check` | GET | Triggered by Vercel Cron daily — checks deadlines, sends reminder emails via Resend, protected by `CRON_SECRET` |

## 6. UI Pages
- `/masters-abroad` — dashboard: upcoming deadlines (next 30 days), task completion %, quick links
- `/masters-abroad/universities` — shortlist board (grouped by status), discovery trigger
- `/masters-abroad/tasks` — full checklist, filterable by category/university, dependency-blocked tasks visually greyed out
- `/masters-abroad/timeline` — calendar view of all deadlines
- `/masters-abroad/documents` — document vault, filterable by task/university

## 7. Acceptance Criteria
- Tasks with unmet dependencies cannot be marked complete (UI blocks it, API validates it too)
- AI-suggested universities are always visually distinguished (badge) and cannot show a deadline as "trusted" until `verified = true`
- Cron job never double-sends a reminder for the same threshold (idempotent via `reminder_sent_*` flags)
- Email reminders fire correctly at each of the 4 thresholds relative to `deadline`
