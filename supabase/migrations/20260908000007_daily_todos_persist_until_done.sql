-- Reshapes daily_todos from "one JSONB blob per calendar day" to one row
-- per task. The original shape couldn't express "stays visible until
-- done" — a task pinned to a single date row vanished the next day
-- whether or not it was ever completed. Now: a pending task has no date
-- attached to it at all (it just keeps showing up, any day, until done or
-- deleted), and a done task is stamped with the day it was completed
-- (done_on) so it's visible that day only — the API drops it once
-- done_on is in the past. Still no real history: nothing before today is
-- ever kept once it's done.
drop table if exists daily_todos;

create table daily_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  text text not null,
  done boolean not null default false,
  done_on date, -- set to the local date when marked done; cleared if un-checked
  created_at timestamptz default now()
);

alter table daily_todos enable row level security;

create policy "own rows" on daily_todos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on daily_todos for select to authenticated
  using (is_admin(auth.uid()));
