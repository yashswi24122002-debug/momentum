-- Calorie tracker had no per-day row at all (unlike habits) — a day with
-- nothing logged just reads as "0 kcal, missed goal" instead of "away".
-- Mirrors the habit-leave pattern: mark a date range as leave, and every
-- date-aware read (dashboard, history) treats those days as excused rather
-- than a failed day.
create table calorie_leave_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  date date not null,
  note text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table calorie_leave_days enable row level security;

create policy "own rows" on calorie_leave_days for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on calorie_leave_days for select to authenticated
  using (is_admin(auth.uid()));
