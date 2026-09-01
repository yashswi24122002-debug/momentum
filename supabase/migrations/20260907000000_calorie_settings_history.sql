-- Fixes "changing today's calorie goal also changed past days' goals":
-- calorie_settings was a single mutable row per user, updated in place on
-- every save, so every day's dashboard/history read the same current row
-- regardless of which date was being viewed. Turns it into an append-only
-- history instead — each save inserts (or, for a same-day re-edit,
-- upserts) a row stamped with the date it took effect, and every date-
-- aware read resolves the most recent row on or before that date.
alter table calorie_settings add column effective_from date not null default current_date;
update calorie_settings set effective_from = created_at::date;

-- A second edit on the same day updates that day's row instead of
-- creating a duplicate "effective today" row.
alter table calorie_settings add constraint calorie_settings_user_effective_key unique (user_id, effective_from);

create index calorie_settings_user_effective_idx on calorie_settings (user_id, effective_from desc);
