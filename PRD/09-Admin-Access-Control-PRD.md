# Admin & Multi-User Access Control — PRD

**Status:** Planning
**Owner:** Solo project — admin (Yashswi) manages a small set of invited friends
**Platform:** Momentum PWA
**Depends on:** Every existing tool (00–08) — this is the first change that turns Momentum from single-user into admin + multiple restricted members

## 1. Purpose

Momentum was built single-user: one Supabase Auth account, no signup, every table's RLS policy is "any authenticated session gets full access" because there was only ever one such session. The admin now wants to let friends use the app too, but:

- **The admin controls everything.** Only the admin can create accounts, decide which tools each person can see, and set how much AI usage each person gets.
- **Nobody spends the admin's Gemini quota.** Every invited member's AI usage (idea generation, content generation, university discovery, calorie photo analysis, job-outreach drafting) runs on **that member's own Gemini API key**, entered by the admin on their behalf. If a member has no key on file, their AI features are blocked with a clear message — never silently falling back to the admin's key.
- **The admin tab is truly admin-only.** Not hidden-by-navigation-only — enforced server-side on every admin page and API route, so a member cannot reach it by guessing the URL, editing the DOM, or calling the API directly.
- **Members are private from each other, not from the admin.** A member's habits, ideas, jobs, calorie logs, etc. are invisible to other members and never mixed with the admin's own data — but the admin can see every member's data through a proper dashboard, since the admin is the one running and supporting this for their friends.

This PRD covers the access-control system itself (roles, per-tool gating, per-feature quotas, per-user API keys, the admin UI) and the mandatory data-isolation migration every existing tool needs to support more than one real user.

## 2. Goals and Boundaries

### Goals

- Admin can create a member account without any public signup form existing.
- Admin can toggle, per member, which of the 6 tools (Habits, Ideas, Content, Masters Abroad, Jobs, Calories) they can see and use at all.
- Admin can set, per member per AI feature, a daily usage cap (a number, or unlimited).
- Admin can add/update/remove a member's own Gemini API key; that key — not the admin's — is what powers that member's AI calls.
- A member only ever sees and modifies their own data in every tool — but the admin can view (read-only) any member's data across every tool from an admin dashboard.
- The `/admin` area and every `/api/admin/*` route reject anyone who isn't the admin, checked server-side, every time — not just hidden in the sidebar.
- The admin's own account and data are unaffected in shape — the admin keeps full access to every tool with no limits, as today.

### Out of scope for v1

- Public self-signup (admin always creates accounts, no open registration).
- Billing/payment for member accounts.
- Per-member custom AI providers other than Gemini (structure allows adding more later, only Gemini now).
- Fine-grained per-action permissions beyond "tool on/off" + "daily AI cap" (e.g. no per-field data permissions).
- Real-time usage analytics/dashboards beyond a simple "used X of Y today" readout.
- Members inviting other members, or any non-admin account management.

## 3. Product Principles

- **Server-side enforcement, always.** Every gate (admin-only, tool access, usage cap, whose API key to use) is checked in the API route or server component itself. Client-side hiding is a convenience, never the security boundary.
- **Fail closed.** No tool access row → tool is hidden and its APIs reject. No API key on file → AI features are blocked with an explicit message, never a silent fallback to someone else's key or quota.
- **The admin is not a row you can edit into existence.** Admin status is anchored to a fixed identity (env var), re-checked against the database role on every request — a bug in a PATCH endpoint should never be able to grant admin.
- **Members are strangers to each other.** No cross-member visibility of data, usage, or existence beyond what the admin's own UI shows.
- **Least surprise for a friend using this for the first time.** A blocked feature says exactly why (no tool access vs. no API key vs. daily cap reached) and what would unblock it.

## 4. Roles and Identity

| Concept | Detail |
|---|---|
| `profiles` table | One row per Supabase Auth user (admin included), holding `role` (`admin` \| `member`), `display_name`, `must_change_password`. |
| Who is admin | `profiles.role = 'admin'` **and** the account's email matches the `ADMIN_EMAIL` env var. Both must agree — a role flip in the DB alone (bug, bad migration, direct SQL) cannot grant admin without also matching the fixed env var, and vice versa. |
| New accounts | Always created by the admin via the Admin UI (`supabase.auth.admin.createUser`, service-role, same pattern already used by cron routes) with a temporary password shown once to the admin to relay to their friend directly (WhatsApp/text — this is a small circle of real-life friends, not a public product). No signup form ever exists. |
| First login | `profiles.must_change_password = true` on creation; the app forces a password-change screen before anything else on first login, then flips it false. |

## 5. Data Strategy — Isolation Migration

Every existing per-user table needs a `user_id uuid not null references profiles(id) on delete cascade` column and its RLS policy rewritten from today's blanket `for all to authenticated using (true)` to `using (auth.uid() = user_id)`.

| Existing table | Treatment |
|---|---|
| `habits`, `habit_logs`, `weekly_todos` | Per-user |
| `ideas`, `idea_reports` | Per-user |
| `universities`, `tasks`, `documents`, `reminder_log` | Per-user |
| `resumes`, `outreach`, `applications` | Per-user |
| `job_postings` | **Stays shared/global** — one admin-run aggregation cron feeds everyone with Jobs access; a member's `outreach`/`applications` rows (which *are* per-user) reference it |
| `trips`, `media`, `content_ideas`, `content_reports` | Per-user |
| `calorie_settings`, `food_logs`, `food_log_items`, `recipes`, `recipe_ingredients`, `food_favourites` | Per-user |
| `foods` | **Split**: rows with `is_indian_food = true` or `source in ('open_food_facts')` stay shared/global (the catalogue + barcode cache benefits everyone); rows with `is_personal = true` become per-user |
| `food_servings` | Follows its parent `foods` row's treatment |
| `error_logs` | Stays admin-only visibility (no `user_id`, already service-role-written) |

**Migration sequence** (per table, to avoid breaking currently-live data): add the column nullable → backfill every existing row to the admin's own `profiles.id` (today's only real user) → alter to `not null` → drop the old blanket policy → add the new per-user policy. Every existing API route in every tool needs its Supabase queries scoped to `.eq("user_id", user.id)` (inserts must set it, selects/updates/deletes must filter by it) — this touches essentially every route file across all 6 tools.

**Admin read access:** every per-user table's policy is actually two policies, not one — members get `select`/`insert`/`update`/`delete` scoped to `auth.uid() = user_id`, and the admin additionally gets a `select`-only policy scoped to `is_admin(auth.uid())` (defined in §6). The admin can view any member's data through the dashboard (§10) but never edits it directly through that view — write access stays owner-only.

## 6. New Tables

```sql
create type user_role as enum ('admin', 'member');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'member',
  must_change_password boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Per-member, per-tool visibility. No row (or enabled = false) = hidden and blocked.
-- The admin bypasses this table entirely in code (always full access) — no rows needed for the admin.
create table tool_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tool_key text not null check (tool_key in ('habits','ideas','content','masters_abroad','jobs','calories')),
  enabled boolean not null default false,
  updated_at timestamptz default now(),
  unique(user_id, tool_key)
);

-- One Gemini key per member, entered by the admin. Application-level encrypted
-- (AES-256-GCM, key in API_KEY_ENCRYPTION_SECRET env var — never in the DB),
-- never decrypted back to any client, only used server-side at call time.
create table user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'gemini' check (provider in ('gemini')),
  api_key_encrypted text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

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

-- Actual usage, keyed by local calendar date — "daily" reset is automatic,
-- no cron needed. Incremented server-side (service role) at the moment a
-- feature is invoked, checked against usage_limits before allowing it.
create table usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  feature_key text not null,
  usage_date date not null,
  count int not null default 0,
  unique(user_id, feature_key, usage_date)
);
```

### RLS for the new tables

`profiles`: a member can `select`/`update` (display name only) their own row; the admin can `select`/`update` any row.
`tool_access`, `usage_limits`, `usage_counters`: a member can `select` their own rows (to show "3/10 used today" in their own UI); only the admin can `insert`/`update`/`delete` any row. `usage_counters` increments happen via the service-role client from inside the API route, bypassing RLS.
`user_api_keys`: **admin-only, full stop** — no policy grants a member any access to this table at all, not even their own row. The key is a credential the admin manages, never something the owning member reads back.

```sql
create or replace function is_admin(uid uuid) returns boolean as $$
  select exists(select 1 from profiles where id = uid and role = 'admin');
$$ language sql security definer stable;
```

## 7. Security Model for the Admin Area

| Layer | Enforcement |
|---|---|
| Sidebar | "Admin" nav item rendered only when the session's profile role is `admin` — cosmetic only, not a security boundary. |
| `/admin/*` pages | A server-side check (in the route's layout/page, mirroring how `proxy.ts` already redirects unauthenticated sessions) that resolves the session, loads the profile, and 404s/redirects if `role !== 'admin'` or the email doesn't match `ADMIN_EMAIL`. |
| `/api/admin/*` routes | Every route calls a new `requireAdmin()` guard (same shape as the existing `requireUser()` in `lib/supabase/route-guard.ts`) before touching anything — returns 403 JSON otherwise. |
| Every other tool's routes | Gain a `requireToolAccess(user, 'ideas')`-style check in addition to `requireUser()`, so hiding a nav item is never the only thing stopping a direct API call. |
| Database | RLS as described above — even a bug in application-layer checks can't leak another user's row, because Postgres itself won't return it. |

## 8. Per-Feature Usage Limits — Enforcement

Each AI-calling route gains a guard before it calls Gemini:

1. Resolve the caller's Gemini key (§9). If none and caller isn't admin → 403, "Ask the admin to add your Gemini API key to use this feature."
2. Look up `usage_limits` for `(user_id, feature_key)`. If `daily_limit` is set, read/upsert today's `usage_counters` row; if `count >= daily_limit` → 429, "You've used your N/day limit for this — try again tomorrow."
3. On a successful generation, increment the counter.

`feature_key` values map directly to existing routes: `ideas_generate` → `/api/ideas/generate`, `content_generate` → `/api/content/generate`, `masters_discover` → `/api/universities/discover`, `calories_analyse_photo` → `/api/calories/analyse-photo`, `jobs_draft_outreach` → `/api/jobs/[id]/draft-outreach`.

## 9. Per-User Gemini API Keys

`lib/ai/generate-content.ts` and `lib/ai/analyse-food.ts` currently hold a module-level `GoogleGenAI` client keyed to `process.env.GEMINI_API_KEY`. Both become parameterized by an API key resolved per request:

```ts
// lib/admin/resolve-api-key.ts
export async function resolveGeminiApiKey(supabase, userId: string, isAdmin: boolean): Promise<string> {
  if (isAdmin) return process.env.GEMINI_API_KEY!; // admin always uses their own env key
  const { data } = await supabase.from("user_api_keys").select("api_key_encrypted").eq("user_id", userId).eq("provider", "gemini").maybeSingle();
  if (!data) throw new NoApiKeyError();
  return decrypt(data.api_key_encrypted);
}
```

Encryption/decryption is plain Node `crypto` (AES-256-GCM) in `lib/admin/crypto.ts`, keyed by `API_KEY_ENCRYPTION_SECRET` (a new env var, server-only, never in Supabase). The admin's own key stays exactly as it is today (`GEMINI_API_KEY` env var) — no behavior change for the admin's own usage.

## 10. Admin UI — Pages and Flows

| Route | Function |
|---|---|
| `/admin` | Overview: member count, quick links |
| `/admin/users` | List every member (+ the admin), "Invite member" button |
| `/admin/users/new` | Create a member: email, display name → generates a temp password, shown once for the admin to relay |
| `/admin/users/[id]` | Edit one member: display name; per-tool on/off toggles (6 switches); per-AI-feature daily limit (number input or "Unlimited" toggle, per feature); Gemini API key field (write-only — shows "Key on file" / "No key set", never displays the raw value back); deactivate/delete |
| `/admin/users/[id]/dashboard` | **Read-only view of that member's actual data** — per-tool summary cards (habit streaks/completion, ideas generated + status breakdown, job pipeline stage counts, calorie logs/goal adherence, masters-abroad task progress, content ideas), reusing each tool's existing stats logic (`lib/habits/stats.ts` etc.) against the target member's `user_id` instead of the caller's own. No edit affordances here — viewing only. |

**First-login flow for a new member:** log in with the temp password → forced "Set a new password" screen (`must_change_password`) → normal app, but only the tools the admin has already enabled are visible in the sidebar; everything else behaves as if that tool doesn't exist.

## 11. APIs

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/users` | GET/POST | List members / create one (admin-only) |
| `/api/admin/users/[id]` | PATCH/DELETE | Update display name/role, deactivate (admin-only) |
| `/api/admin/users/[id]/tool-access` | PATCH | Bulk-set the 6 tool toggles (admin-only) |
| `/api/admin/users/[id]/limits` | PATCH | Bulk-set daily caps per feature (admin-only) |
| `/api/admin/users/[id]/api-key` | PATCH/DELETE | Set/remove a member's Gemini key (admin-only, write-only) |
| `/api/admin/users/[id]/dashboard` | GET | Read-only aggregated stats across every tool for that member (admin-only) |
| `/api/me` | GET | Current session's profile + own tool_access + own usage_limits/counters (drives nav filtering and "X/Y used today" for any user) |

## 12. Cross-Cutting Impact on Existing Code

- **Every cron route** (`deadline-check`, `aggregate-jobs`, `send-scheduled-emails`) currently assumes one user via `auth.admin.listUsers()[0]`. These must loop over every member who has the relevant tool enabled, scoping each pass to that member's own rows and sending reminder emails to that member's own address — not just the admin's.
- **Every existing tool route** needs its Supabase calls scoped to `user_id = session.user.id` (§5) and gains the `requireToolAccess` check (§7).
- **The three existing AI-calling routes** (`ideas/generate`, `content/generate`, `universities/discover`) plus the two Calorie Tracker/Jobs ones already covered in §8 all need the usage-limit guard and per-user key resolution.
- **Nav (`components/shared/nav-items.ts`)** needs to filter its 6 tool groups by the current user's `tool_access`, plus a new conditionally-rendered "Admin" entry.

## 13. Delivery Plan

1. **Phase 1 — Roles & admin shell**: `profiles` table (backfill the existing account as admin), `requireAdmin()` guard, `/admin` shell with server-side gating, no user management yet — just prove the security boundary works.
2. **Phase 2 — Data isolation migration**: add `user_id` to every existing table per §5, backfill to the admin, rewrite every route's queries and RLS policies. Highest-risk, highest-effort phase — the admin's existing data must come through unchanged.
3. **Phase 3 — User management**: invite flow, `tool_access` table + nav filtering + route guards.
4. **Phase 4 — Usage limits**: `usage_limits`/`usage_counters`, enforcement in the 5 AI routes, admin UI for setting caps.
5. **Phase 5 — Per-user API keys**: `user_api_keys` + encryption, `resolveGeminiApiKey`, wiring into all 5 AI call sites, admin UI field.
6. **Phase 6 — Cron/reminder fixes**: make the three existing cron routes iterate per-member instead of assuming one user.

## 14. Acceptance Criteria

- A brand-new member, logged in for the first time, is forced to set a password and sees only the tools the admin enabled — everything else is absent from navigation and returns 403/404 if hit directly by URL.
- A member's habits/ideas/jobs/calories data is never visible to another *member*, verified by attempting a direct API call for another user's row ID (must fail) — but the admin can view any member's data via `/admin/users/[id]/dashboard`.
- A member with no Gemini key configured gets a clear blocking message on any AI feature, never a silent fallback to the admin's key.
- A member's AI usage, once they have a key, is billed against their own key and counted against their own daily cap — reaching the cap blocks further use until the next calendar day, with a clear message.
- Visiting `/admin` or calling any `/api/admin/*` route as a non-admin (even a valid logged-in member) fails server-side regardless of what the client sends.
- The admin's own account retains full, unlimited access to every tool exactly as before this change.
- All three existing cron jobs correctly address every member with the relevant tool enabled, not just the admin.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Data-isolation migration breaks the admin's existing live data | Backfill every new `user_id` column to the admin's profile id before making it `not null`; test each table's queries against the admin account before enabling for members |
| A bug grants a member admin access | Admin check requires both `profiles.role = 'admin'` and a match against the fixed `ADMIN_EMAIL` env var — a single-layer DB bug can't be sufficient |
| Member's Gemini key is invalid/exhausted | Surface the real provider error distinctly from "no key configured" so the admin/member knows which to fix |
| Storing API keys is a real credential-handling responsibility | Application-level AES-256-GCM encryption, key never stored in Supabase itself, raw value never returned to any client after save |
| Cron jobs silently keep single-user behavior after this ships | Explicit Phase 6 dedicated to auditing and fixing all three existing cron routes |
