-- Same reshape as daily_todos: top_3_tasks was a JSONB blob pinned to one
-- week_start_date row, so an unfinished task vanished the moment the week
-- rolled over. Moves the checklist into its own table, one row per task —
-- a pending task has no week attached, so it keeps appearing every week
-- until done or deleted; a done task is stamped with the week it was
-- finished in (done_on_week) and stays visible only that week. Unlike
-- daily tasks this has no "no history" requirement, so completed rows
-- are just filtered out of later weeks' view, not deleted.
alter table weekly_todos drop column top_3_tasks;

create table weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  text text not null,
  done boolean not null default false,
  done_on_week date,
  created_at timestamptz default now()
);

alter table weekly_tasks enable row level security;

create policy "own rows" on weekly_tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on weekly_tasks for select to authenticated
  using (is_admin(auth.uid()));
