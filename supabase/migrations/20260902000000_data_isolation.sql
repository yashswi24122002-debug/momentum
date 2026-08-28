-- Admin & Multi-User Access Control Phase 2 (09-Admin-Access-Control-PRD.md
-- §5): per-user data isolation across every existing tool. Every top-level
-- table gets `user_id ... default auth.uid()` — Postgres applies that
-- default on every insert automatically, and the new RLS policies filter
-- every select/update/delete to the caller's own rows, so almost none of
-- this needs an application-code change: the database enforces it
-- regardless of what the app's query looks like. The one place that isn't
-- true is the two cron routes that use the service-role client (no
-- session, so no auth.uid() to default to) — those are handled separately
-- in application code, not by this migration.

-- ============================================================
-- Group A: top-level per-user tables (own column + default auth.uid())
-- ============================================================

do $$
declare
  t text;
  admin_id uuid := (select id from profiles where role = 'admin' limit 1);
begin
  for t in
    select unnest(array[
      'habits', 'weekly_todos', 'ideas', 'universities', 'tasks', 'documents',
      'resumes', 'outreach', 'applications', 'trips', 'media', 'content_ideas',
      'calorie_settings', 'recipes', 'food_logs', 'food_favourites'
    ])
  loop
    execute format('alter table %I add column user_id uuid references profiles(id) on delete cascade default auth.uid()', t);
    execute format('update %I set user_id = $1 where user_id is null', t) using admin_id;
    execute format('alter table %I alter column user_id set not null', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format('create policy "own rows" on %I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "admin reads all" on %I for select to authenticated using (is_admin(auth.uid()))', t);
  end loop;
end $$;

-- ============================================================
-- Group B: child tables — ownership derives from a parent FK, no column
-- of their own. Their lifecycle already cascades from that parent.
-- ============================================================

drop policy if exists "authenticated full access" on habit_logs;
create policy "via habit ownership" on habit_logs for all to authenticated
  using (exists (select 1 from habits h where h.id = habit_logs.habit_id and (h.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid()));

drop policy if exists "authenticated full access" on idea_reports;
create policy "via idea ownership" on idea_reports for all to authenticated
  using (exists (select 1 from ideas i where i.id = idea_reports.idea_id and (i.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from ideas i where i.id = idea_reports.idea_id and i.user_id = auth.uid()));

drop policy if exists "authenticated full access" on reminder_log;
create policy "via task ownership" on reminder_log for all to authenticated
  using (exists (select 1 from tasks t where t.id = reminder_log.task_id and (t.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from tasks t where t.id = reminder_log.task_id and t.user_id = auth.uid()));

drop policy if exists "authenticated full access" on content_reports;
create policy "via content idea ownership" on content_reports for all to authenticated
  using (exists (select 1 from content_ideas c where c.id = content_reports.content_idea_id and (c.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from content_ideas c where c.id = content_reports.content_idea_id and c.user_id = auth.uid()));

drop policy if exists "authenticated full access" on recipe_ingredients;
create policy "via recipe ownership" on recipe_ingredients for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and (r.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()));

drop policy if exists "authenticated full access" on food_log_items;
create policy "via food log ownership" on food_log_items for all to authenticated
  using (exists (select 1 from food_logs f where f.id = food_log_items.food_log_id and (f.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from food_logs f where f.id = food_log_items.food_log_id and f.user_id = auth.uid()));

-- ============================================================
-- Group C: foods — split. Catalogue/barcode-cache rows (source in
-- ('ifct_reference','open_food_facts')) stay shared with user_id null;
-- personal foods (is_personal = true) get a real owner. No column
-- default here on purpose — a default would silently attach every future
-- barcode-cache insert to whichever user happened to scan it first,
-- instead of leaving it global. lib/calories/foods (the personal-food
-- creation route) sets user_id explicitly in application code instead.
-- ============================================================

alter table foods add column user_id uuid references profiles(id) on delete cascade;
update foods set user_id = (select id from profiles where role = 'admin' limit 1)
  where is_personal = true and user_id is null;

drop policy if exists "authenticated full access" on foods;
create policy "read own or global" on foods for select to authenticated
  using (user_id is null or auth.uid() = user_id or is_admin(auth.uid()));
create policy "insert own" on foods for insert to authenticated
  with check (auth.uid() = user_id);
create policy "update own" on foods for update to authenticated
  using (auth.uid() = user_id or is_admin(auth.uid()))
  with check (auth.uid() = user_id or is_admin(auth.uid()));
create policy "delete own" on foods for delete to authenticated
  using (auth.uid() = user_id or is_admin(auth.uid()));

drop policy if exists "authenticated full access" on food_servings;
create policy "via foods ownership" on food_servings for all to authenticated
  using (exists (select 1 from foods f where f.id = food_servings.food_id and (f.user_id is null or f.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from foods f where f.id = food_servings.food_id and f.user_id = auth.uid()));

-- ============================================================
-- Group D: unchanged (job_postings stays global/shared on purpose —
-- one admin-run aggregation feeds every member with Jobs access) and
-- tightened (error_logs is an operational log, not user data — no
-- member, not even the admin's own non-admin session, should see it;
-- only the admin role can read it, and only service-role ever writes it).
-- ============================================================

drop policy if exists "authenticated full access" on error_logs;
create policy "admin only" on error_logs for select to authenticated
  using (is_admin(auth.uid()));
