-- When the admin's own Gemini key is exhausted, generateContentAsUser()
-- round-robins across every member's key with no throttle at all — a
-- stuck client-side retry loop, or just rapid clicking once the admin's
-- key is already blown for the day, could cascade through several
-- members' real quota in the same short window. This adds a rolling
-- rate limit on the fallback path itself (not on regular per-feature
-- usage, which usage_limits/usage_counters already cover) — a burst
-- that exceeds it just surfaces the original quota error instead of
-- cascading further, rather than silently keep burning member keys.

alter table ai_fallback_rotation add column window_started_at timestamptz not null default now();
alter table ai_fallback_rotation add column window_count int not null default 0;

create or replace function check_fallback_rate_limit(p_max_per_window int, p_window_seconds int) returns boolean
language plpgsql
as $$
declare
  v_window_started_at timestamptz;
  v_window_count int;
begin
  select window_started_at, window_count into v_window_started_at, v_window_count
  from ai_fallback_rotation where id = true for update;

  if now() - v_window_started_at > make_interval(secs => p_window_seconds) then
    update ai_fallback_rotation set window_started_at = now(), window_count = 1 where id = true;
    return true;
  end if;

  if v_window_count >= p_max_per_window then
    return false;
  end if;

  update ai_fallback_rotation set window_count = window_count + 1 where id = true;
  return true;
end;
$$;
