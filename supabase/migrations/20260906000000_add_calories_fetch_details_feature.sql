-- Adds "calories_fetch_details" (the personal-food AI nutrition-fetch
-- button) as a 6th usage-capped AI feature, alongside the original 5 from
-- 09-Admin-Access-Control-PRD.md §8. No backfill needed — a missing
-- usage_limits row already means "unlimited" (lib/admin/usage.ts), exactly
-- like every other feature before the admin explicitly sets a cap.
alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach'
));
