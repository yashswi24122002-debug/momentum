# Habit Tracker — PRD

## 1. Purpose
A simple, reliable daily habit checklist with CRUD management and clear visual feedback on consistency. No AI, no external data — pure CRUD + client-side visualization.

## 2. User Flow

1. **Manage habits**: add/edit/archive habits from a settings-style list (`/habits/manage`)
2. **Daily check-in**: `/habits` shows today's active habits as a checklist — tap to mark complete (boolean only)
3. **Grid view**: monthly calendar grid, habit × day, historical read-only + editable for recent days
4. **Dashboard**: completion % trend (last 12 weeks), daily productivity bar chart, done/not-done pie chart, current streaks
5. **Insights (v1 lite)**: best/worst habit by completion %, best/worst day of week, longest current streak
6. **Weekly To-Do sidebar**: top weekly priority + top 3 tasks, separate from habits

## 3. Data Model

```sql
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
  top_3_tasks jsonb default '[]'  -- [{ "text": "string", "done": boolean }]
);
```

Streaks and completion % are computed via SQL aggregation/window functions at query time (no separate cache table needed at this data volume).

## 4. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/habits` | GET/POST | List active habits / create new |
| `/api/habits/[id]` | PATCH/DELETE | Edit, archive (soft-delete via `archived_at`) |
| `/api/habits/[id]/log` | POST | Toggle completion for a given date |
| `/api/habits/logs` | GET | Fetch logs for a date range (grid/dashboard queries) |
| `/api/weekly-todos` | GET/POST/PATCH | Manage current week's priority/tasks |

## 5. UI Pages
- `/habits` — today's checklist (primary daily-use screen)
- `/habits/grid` — monthly grid view, month selector
- `/habits/dashboard` — charts: completion trend, daily productivity bar chart, pie chart, streaks, best/worst insights
- `/habits/manage` — CRUD for habit list, drag-to-reorder

## 6. Acceptance Criteria
- Marking a habit complete/incomplete updates instantly (optimistic UI) and persists correctly
- Archiving a habit removes it from the daily checklist but preserves all historical `habit_logs`
- Grid view correctly reflects `habit_logs` for the selected month with no off-by-one date errors (careful with timezone handling — store and compare dates in a single consistent timezone)
- Streak calculation correctly handles gaps (a missed day resets the current streak, but longest streak is preserved historically)
