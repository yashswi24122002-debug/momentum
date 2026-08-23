# Momentum — Master PRD

**Owner:** Solo project (single user)
**Purpose:** A personal command center consolidating five tools that support career growth, further education planning, job search, habit consistency, and personal content creation.
**Repo type:** Single Next.js monorepo (frontend + backend API routes in one deployable unit)

---

## 1. Product Overview

Momentum is a private, single-user web application (installable as a PWA on mobile) consisting of five independent but co-located tools:

| # | Tool | Core Function | Automation Level |
|---|------|---------------|-------------------|
| 1 | **Ideas Tool** | Scrapes tech/startup trend signals, AI-generates 3 project ideas/day on demand, approve/reject flow, deep-dive report on approval | On-demand + AI |
| 2 | **Masters Abroad Tool** | Checklist/tracker for MS Cybersecurity applications to Germany — documents, deadlines, university shortlist/discovery | Scheduled reminders + AI-assisted discovery |
| 3 | **Jobs Automation** | Aggregates tech job postings from compliant sources, AI-drafted personalized cold emails (human-reviewed), application pipeline tracker | Scheduled aggregation + manual-reviewed sending |
| 4 | **Habit Tracker** | Daily boolean habit checklist, CRUD, dashboards, streaks, insights | Pure CRUD, no AI |
| 5 | **Content Creation** | Scrapes travel-content trend signals, cross-references your photo library, AI-generates 3 Instagram content ideas/day, approve/reject flow, report | On-demand + AI |

All five tools are independent modules sharing one auth session, one database, one design system, and one deployment.

---

## 2. Goals & Non-Goals

**Goals**
- Single place to manage self-growth, job search, further education, habits, and content — reducing tool-switching and mental overhead
- Fully free-tier deployable (no recurring cost at current usage volume)
- Usable identically on laptop (full browser) and phone (installed PWA)
- Each tool should produce *actionable* output, not just information — approve/reject flows, reports, next actions, not passive dashboards

**Non-Goals**
- Not a multi-user product — no user management, no public sign-up, no billing
- Not attempting to fully automate job applications end-to-end (portal auto-fill is explicitly out of scope — see Jobs Automation PRD)
- Not building a native mobile app — PWA only
- Not scraping platforms that prohibit it in their ToS (LinkedIn profile scraping, Instagram/TikTok scraping) — using compliant APIs/sources instead throughout

---

## 3. Tech Stack (Final)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Single repo for frontend + API routes, deploys natively to Vercel |
| Hosting | **Vercel (free/Hobby tier)** | Native Next.js support, free Cron Jobs, generous bandwidth for personal use |
| Database | **Supabase (Postgres)** | Relational data fits all 5 tools' needs (dependencies, joins, date-range queries); generous free tier |
| Auth | **Supabase Auth** | Free, simple email/password login gate since you're the only user |
| File Storage | **Supabase Storage** | Same project as DB — resumes, documents, travel photos |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible components; easy dark theme via CSS variables |
| Charts | **Recharts** | Used in Habit Tracker dashboards |
| Email | **Resend (free tier: 100/day, 3k/month)** | Used for Masters Abroad deadline reminders + Jobs Automation cold emails |
| AI | **Google Gemini API (free tier, `gemini-2.5-flash`)** | Used for idea generation, reports, email drafting, content ideation — abstracted behind one internal function so provider is swappable later |
| Scheduled Jobs | **Vercel Cron Jobs** | Daily deadline check (Masters Abroad), daily job aggregation (Jobs Automation), scheduled email sends |
| External data | Hacker News (Algolia API), GitHub Trending, Reddit public JSON feeds, Greenhouse, Lever, RemoteOK, Remotive, Arbeitnow, Adzuna, Jooble, Hunter.io, Google Trends (pytrends), YouTube Data API, Pinterest Trends | All free-tier, unauthenticated, or public endpoints — see per-tool PRDs |

---

## 4. Repository Structure (proposed)

```
momentum/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── ideas/
│   │   ├── masters-abroad/
│   │   ├── jobs/
│   │   ├── habits/
│   │   └── content/
│   ├── api/
│   │   ├── ideas/
│   │   ├── masters-abroad/
│   │   ├── jobs/
│   │   ├── habits/
│   │   ├── content/
│   │   └── cron/
│   └── layout.tsx
├── components/
│   ├── ui/              # shadcn components
│   └── shared/          # cross-tool components (cards, nav, etc.)
├── lib/
│   ├── supabase/        # client + server helpers
│   ├── ai/              # generateContent(prompt) abstraction over Gemini
│   ├── email/           # Resend wrapper
│   └── integrations/    # HN, Reddit, Greenhouse, Hunter.io, etc. wrappers
├── supabase/
│   └── migrations/      # SQL migration files
├── public/
├── .env.local.example
└── package.json
```

---

## 5. Design System

**Theme:** Dark, single-theme (no light mode toggle needed for v1 — reduces build complexity for a solo tool)

**Font:** Geist Sans (UI text), Geist Mono (data/numbers/code) — both free, made by Vercel, first-class Next.js support (`next/font/google` or bundled)

**Color Tokens** (CSS variables, Tailwind config extends these):

```css
--background:      #0A0E0D   /* near-black, subtle green undertone */
--surface:          #121716   /* cards, panels */
--surface-hover:    #1A211F
--border:           #232B29
--text-primary:     #F3F5F4
--text-secondary:   #9CA8A5
--text-muted:       #6B7674

--accent:           #10B981   /* emerald-500 — primary actions, links */
--accent-hover:     #34D399   /* emerald-400 */
--accent-muted-bg:  #06251C   /* subtle backgrounds, badges */

--success:          #10B981
--warning:          #F59E0B
--danger:           #EF4444
--info:             #38BDF8
```

**Layout principles**
- Mobile-first: design every screen for a 375-400px viewport first, then expand for desktop with more columns/whitespace, not different structure
- Persistent bottom tab bar on mobile (5 tabs), sidebar nav on desktop
- Cards over tables where possible (better mobile ergonomics) — tables acceptable for dense data (e.g., job listings) on desktop only, cards on mobile
- Generous spacing, minimal borders — rely on subtle background shifts (`--surface` vs `--background`) to separate sections rather than heavy dividers
- Empty states matter — every list (ideas, tasks, jobs) needs a designed empty state with a clear call-to-action, not a blank screen

**Component conventions**
- Approve/Reject actions (Ideas Tool, Content Tool): green check / red X icon buttons, not text buttons — fast tap targets on mobile
- Status badges (pipeline stages) use consistent color mapping across all tools: `backlog/new` = gray, `in progress` = info blue, `blocked/attention needed` = warning amber, `done/success` = accent green, `rejected/abandoned` = danger red (muted)

---

## 6. Cross-Cutting Concerns

**Authentication:** Single-user email/password via Supabase Auth. No public sign-up route — the one account is created manually via Supabase dashboard or a one-time seed script. All routes behind auth middleware except `/login`.

**Environment variables:** all required variables and their actual values live in `08-Credentials-Reference.md` — a separate file kept out of the main PRD text intentionally, since it contains real secrets. **Never commit that file to git.** The variable names your code should reference are:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
RESEND_API_KEY
YOUTUBE_API_KEY
ADZUNA_APP_ID
ADZUNA_APP_KEY
JOOBLE_API_KEY
HUNTER_API_KEY
CRON_SECRET
```

**Error handling:** Every external API integration (Gemini, Reddit, job boards, etc.) must fail gracefully — if a source is down, skip it and proceed with remaining sources rather than failing the whole request. Log failures to a simple `error_logs` table for visibility since there's no ops team to alert.

**Rate limiting awareness:** Free-tier APIs all have quotas. Since this is on-demand (not high-frequency automated), volume stays low, but each integration wrapper should handle 429 responses gracefully (clear error message, not a crash).

---

## 7. Build Phasing (recommended order)

1. **Foundation**: Next.js scaffold, Supabase setup, auth, design system/shared components, nav shell (all 5 tabs visible, empty states)
2. **Habit Tracker** (simplest, pure CRUD — validates the whole stack works end-to-end)
3. **Ideas Tool** (introduces AI + external data pattern, reused by Content Creation)
4. **Content Creation** (reuses Ideas Tool pattern + adds Media Library)
5. **Masters Abroad** (introduces cron + email reminders)
6. **Jobs Automation** (most complex — reuses cron, email, and AI patterns from above)

This order front-loads the simplest tool to validate infrastructure, then each subsequent tool reuses a pattern already proven by an earlier one.

---

## 8. Individual Tool PRDs

See companion documents:
- `01-Ideas-Tool-PRD.md`
- `02-Masters-Abroad-PRD.md`
- `03-Jobs-Automation-PRD.md`
- `04-Habit-Tracker-PRD.md`
- `05-Content-Creation-PRD.md`

See also:
- `06-Setup-Guide.md` — account creation & environment setup (already completed)
- `07-Claude-Code-Prompt.md` — prompt to paste into Claude Code alongside these PRDs
- `08-Credentials-Reference.md` — **actual secret values, kept separate from this document, never commit to git**
