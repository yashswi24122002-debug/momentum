-- Ad-hoc daily tasks — a quick same-day todo list, separate from tracked
-- habits (never shown on the grid or dashboard, no streaks, no history).
-- One row per (user, date), same JSONB-array-of-tasks shape as
-- weekly_todos. Deliberately no read path for any date but "today" — old
-- rows are opportunistically deleted by the API itself rather than kept.
create table daily_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  date date not null,
  tasks jsonb not null default '[]', -- [{ "text": "string", "done": boolean }]
  updated_at timestamptz default now(),
  unique (user_id, date)
);

alter table daily_todos enable row level security;

create policy "own rows" on daily_todos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on daily_todos for select to authenticated
  using (is_admin(auth.uid()));
