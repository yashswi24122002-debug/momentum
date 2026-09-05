-- checkAndIncrementUsage() (lib/admin/usage.ts) was 3 sequential round
-- trips (select usage_limits, select usage_counters, upsert usage_counters)
-- on every single non-admin AI call, on top of an already-slow free-tier
-- Supabase project. Collapses all three into one round trip. No
-- `security definer` — runs with the caller's own RLS ("own rows" on both
-- tables), so a wrong p_user_id just sees/writes nothing instead of
-- silently bypassing another user's row.
create or replace function check_and_increment_usage(
  p_user_id uuid,
  p_feature_key text,
  p_weight int,
  p_today date
) returns table(allowed boolean, daily_limit int, new_count int)
language plpgsql
as $$
declare
  v_daily_limit int;
  v_current_count int;
begin
  select ul.daily_limit into v_daily_limit
  from usage_limits ul
  where ul.user_id = p_user_id and ul.feature_key = p_feature_key;

  select uc.count into v_current_count
  from usage_counters uc
  where uc.user_id = p_user_id and uc.feature_key = p_feature_key and uc.usage_date = p_today;
  v_current_count := coalesce(v_current_count, 0);

  if v_daily_limit is not null and v_current_count + p_weight > v_daily_limit then
    return query select false, v_daily_limit, v_current_count;
    return;
  end if;

  insert into usage_counters (user_id, feature_key, usage_date, count)
  values (p_user_id, p_feature_key, p_today, v_current_count + p_weight)
  on conflict (user_id, feature_key, usage_date) do update set count = excluded.count;

  return query select true, v_daily_limit, v_current_count + p_weight;
end;
$$;
