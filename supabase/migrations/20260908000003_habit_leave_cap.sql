-- Caps how many "mark leave" actions a single habit can absorb per
-- calendar month — without this, excusing days is an unlimited loophole
-- around ever failing a streak. Capped per *use* (one bulk date-range
-- submission), not per day, so a single 7-day vacation still only costs 1
-- use — same pattern as the AI usage_limits/usage_counters tables, just
-- keyed by habit_id + month instead of feature_key + date. Calorie leave
-- days are deliberately NOT capped here (kept unlimited, per product
-- decision) — this table is habits-only.
create table habit_leave_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  habit_id uuid not null references habits(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  count int not null default 0,
  unique (habit_id, month)
);

alter table habit_leave_usage enable row level security;

create policy "own rows" on habit_leave_usage for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on habit_leave_usage for select to authenticated
  using (is_admin(auth.uid()));

-- No `security definer` — runs with the caller's own RLS, same reasoning
-- as check_and_increment_usage(): a wrong p_user_id just sees/writes
-- nothing instead of bypassing another user's row.
create or replace function check_and_increment_habit_leave(
  p_user_id uuid,
  p_habit_id uuid,
  p_month text,
  p_cap int
) returns table(allowed boolean, used int, cap int)
language plpgsql
as $$
declare
  v_used int;
begin
  select hlu.count into v_used
  from habit_leave_usage hlu
  where hlu.habit_id = p_habit_id and hlu.month = p_month;
  v_used := coalesce(v_used, 0);

  if v_used >= p_cap then
    return query select false, v_used, p_cap;
    return;
  end if;

  insert into habit_leave_usage (user_id, habit_id, month, count)
  values (p_user_id, p_habit_id, p_month, v_used + 1)
  on conflict (habit_id, month) do update set count = excluded.count;

  return query select true, v_used + 1, p_cap;
end;
$$;
