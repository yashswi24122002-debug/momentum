-- Fixes a cross-user collision bug found alongside the admin-session data
-- leak (09-Admin-Access-Control-PRD.md §5): weekly_todos.week_start_date
-- kept its original single-user "unique" constraint after Phase 2 added
-- user_id, so two different members both having a row for the same
-- calendar week (which is virtually guaranteed) would collide on
-- insert/upsert — the second one to save would overwrite the first's
-- top-priority/tasks for that week. The app's upsert onConflict target
-- changes from "week_start_date" to "user_id,week_start_date" alongside
-- this migration.
alter table weekly_todos drop constraint weekly_todos_week_start_date_key;
alter table weekly_todos add constraint weekly_todos_user_id_week_start_date_key unique (user_id, week_start_date);
