# Ideas Tool — PRD

## 1. Purpose
Surface 3 feasible, well-scoped project/startup ideas per day, sourced from real trending tech/dev signals, to push toward starting something independent. Approved ideas get a structured deep-dive report; rejected ideas log a reason to refine future taste.

## 2. User Flow

1. User opens **Ideas** tab, clicks **"Generate Today's Ideas"** (manual trigger, no auto-schedule)
2. System fetches raw signals from Hacker News, GitHub Trending, Reddit (r/SideProject, r/startups)
3. Signals sent to Gemini with a structured prompt → returns 3 distinct ideas (spanning different categories: B2B SaaS, tool/automation, niche vertical app)
4. Ideas rendered as cards: title, one-liner, category tag, effort estimate (S/M/L)
5. User taps ✅ **Approve** or ❌ **Reject** per card
   - Reject → quick-select reason modal (`not interested` / `too big` / `seen before` / `not feasible`) → logged, done
   - Approve → second Gemini call generates the deep-dive report → idea moves to **Backlog**
6. Approved ideas appear in a **Pipeline view**: `Backlog → Researching → Building → Shipped → Abandoned` (user manually drags/updates status)
7. **Weekly digest** (computed on page load, not emailed): ideas generated/approved/rejected this week, and any backlog idea untouched 7+ days

## 3. Data Sources

| Source | Endpoint | Auth |
|---|---|---|
| Hacker News | Algolia HN Search API (`https://hn.algolia.com/api/v1/search_by_date`) | None |
| GitHub Trending | Unofficial trending endpoint or lightweight scrape of `github.com/trending` | None |
| Reddit | Public JSON feeds (`reddit.com/r/{subreddit}/top.json`) | None — requires a `User-Agent` header only |

Pull ~20-30 raw signals (titles/snippets) per generation request.

## 4. AI Prompt Contract

**Input:** array of raw signal strings + categories
**Output (strict JSON):**
```json
[
  {
    "title": "string",
    "one_liner": "string",
    "category": "string",
    "effort_estimate": "S | M | L",
    "source_signals": ["string"]
  }
]
```
Exactly 3 items, spanning distinct categories where possible.

**Deep-dive report prompt** (on approval), input = approved idea + original signals, output (strict JSON):
```json
{
  "scope": "string",
  "target_audience": "string",
  "plan": "string (week-by-week for first month)",
  "reliability_doability": "string",
  "next_action": "string (one concrete 24-48hr action)",
  "competitive_landscape": "string",
  "cost_estimate": "string",
  "effort_impact_score": "number (1-10)"
}
```

## 5. Data Model

```sql
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
```

## 6. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ideas/generate` | POST | Fetch signals, call Gemini, insert 3 pending ideas |
| `/api/ideas/[id]/approve` | POST | Trigger report generation, insert `idea_reports` row |
| `/api/ideas/[id]/reject` | POST | Body: `{ reason }` — update status |
| `/api/ideas` | GET | List ideas, filterable by status/date |
| `/api/idea-reports/[id]` | PATCH | Update `lifecycle_status` |

## 7. UI Pages
- `/ideas` — today's pending ideas (cards) + "Generate" button + pipeline board below (grouped by lifecycle_status)
- `/ideas/[id]` — full report detail view for an approved idea, editable lifecycle status

## 8. Acceptance Criteria
- Clicking Generate produces exactly 3 ideas within a reasonable wait (show loading state; Gemini calls may take a few seconds)
- Approve reliably produces a complete report with all 8 fields populated
- Reject always requires a reason before logging
- If any single data source fails (e.g., Reddit rate-limited), generation still proceeds using remaining sources
