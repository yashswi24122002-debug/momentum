-- When the admin's own Gemini key hits its quota, subsequent AI requests
-- round-robin across the Gemini keys the admin has already entered for
-- members (user_api_keys) instead of failing outright. Singleton row +
-- atomic read-and-advance RPC gives every request a stable "whose turn is
-- next" pointer across serverless invocations (no shared in-memory state
-- exists between them).
create table ai_fallback_rotation (
  id boolean primary key default true,
  next_index int not null default 0,
  constraint ai_fallback_rotation_singleton check (id)
);
insert into ai_fallback_rotation (id, next_index) values (true, 0);

alter table ai_fallback_rotation enable row level security;
create policy "admin only" on ai_fallback_rotation for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create or replace function next_fallback_key_index(p_pool_size int) returns int
language plpgsql
as $$
declare
  v_current int;
begin
  if p_pool_size <= 0 then
    return 0;
  end if;

  select next_index into v_current from ai_fallback_rotation where id = true for update;
  update ai_fallback_rotation set next_index = (v_current + 1) % p_pool_size where id = true;
  return v_current % p_pool_size;
end;
$$;
