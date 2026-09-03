-- Habit reminders via Web Push. Two pieces: per-device push subscriptions
-- (a user can have more than one — phone, desktop, etc., though the app
-- only recommends enabling this on the phone install), and per-habit
-- reminder scheduling (time + style: "checkin" fires unconditionally with
-- Yes/No actions, "nudge" only fires if the habit isn't already completed
-- that day). reminder_sent_on makes the cron job idempotent per day.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_type text,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "own rows" on push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin reads all" on push_subscriptions for select to authenticated
  using (is_admin(auth.uid()));

alter table habits add column reminder_time time;
alter table habits add column reminder_style text check (reminder_style in ('checkin', 'nudge'));
alter table habits add column reminder_sent_on date;
