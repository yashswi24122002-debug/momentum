-- leads/discover was the one AI/external-cost route in the app with no
-- checkAndIncrementUsage gate at all — every Places API Text Search call
-- it makes is real, billed usage, and nothing tracked or capped repeated
-- "Find Leads" clicks. Registering a feature key here gives it the same
-- usage_counters tracking (and admin-settable daily_limit) every other
-- AI/external-API feature already has, consistent with this project's
-- pattern of shipping every feature uncapped-by-default (daily_limit
-- null = unlimited) until an admin opts a member into a cap.

alter table usage_limits drop constraint usage_limits_feature_key_check;
alter table usage_limits add constraint usage_limits_feature_key_check check (feature_key in (
  'ideas_generate', 'content_generate', 'masters_discover',
  'calories_analyse_photo', 'calories_fetch_details', 'jobs_draft_outreach', 'jobs_tailor_application',
  'leads_draft_pitch', 'leads_discover'
));
