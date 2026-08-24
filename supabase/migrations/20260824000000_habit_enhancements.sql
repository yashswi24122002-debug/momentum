-- Habit Tracker enhancements: custom weekly schedules, streak-freeze days,
-- per-habit color, and per-entry notes. Additive only — existing rows get
-- safe defaults (frequency_days = every day, matching current behavior).

alter table habits
  add column frequency_days smallint[] not null default '{0,1,2,3,4,5,6}',
  add column color text;

alter table habits
  add constraint habits_frequency_days_valid
    check (frequency_days <@ array[0,1,2,3,4,5,6]::smallint[]);

alter table habit_logs
  add column excused boolean not null default false,
  add column note text;
