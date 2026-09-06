import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { isScheduledOn } from "@/lib/habits/schedule";
import { addDays, todayLocalISODate } from "@/lib/date";

const MAX_RANGE_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Each habit gets a limited number of leave *uses* per calendar month, not
// a limited number of leave *days* — one bulk date-range submission below
// costs a habit exactly 1 use regardless of whether the range is 1 day or
// 90, so a single real vacation doesn't get needlessly rationed. Only
// habits, not calories — that stays unlimited by design.
const MONTHLY_CAP = 4;

// Marks every habit scheduled on each day in [date_from, date_to] as
// excused in one shot — a vacation/leave range instead of toggling each
// habit one day at a time. Reuses the same habit_logs upsert the per-habit
// excuse toggle already uses (lib/habits/stats.ts's isExpected/habitStreaks
// already skip excused days when computing completion % and streaks, so
// this alone is enough to preserve a streak across the leave).
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { date_from, date_to, note } = body as { date_from?: string; date_to?: string; note?: string | null };

  if (!date_from || !ISO_DATE.test(date_from)) {
    return NextResponse.json({ error: "date_from (YYYY-MM-DD) is required" }, { status: 400 });
  }
  const dateTo = date_to && ISO_DATE.test(date_to) ? date_to : date_from;
  if (dateTo < date_from) {
    return NextResponse.json({ error: "date_to must be on or after date_from" }, { status: 400 });
  }
  if (dateTo > todayLocalISODate()) {
    return NextResponse.json({ error: "Can't mark a future date as leave" }, { status: 400 });
  }

  const rangeDays = Math.round((new Date(dateTo).getTime() - new Date(date_from).getTime()) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range can't exceed ${MAX_RANGE_DAYS} days` }, { status: 400 });
  }

  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select("id, name, frequency_days")
    .eq("user_id", user.id)
    .eq("active", true);

  if (habitsError) {
    return NextResponse.json({ error: habitsError.message }, { status: 500 });
  }

  const allDates: string[] = [];
  for (let d = date_from; d <= dateTo; d = addDays(d, 1)) allDates.push(d);

  // A habit not scheduled on any day in the range is untouched — never
  // reported, never charged a use.
  const touchedHabits = (habits ?? [])
    .map((habit) => ({ habit, dates: allDates.filter((d) => isScheduledOn(habit, d)) }))
    .filter((h) => h.dates.length > 0);

  if (touchedHabits.length === 0) {
    return NextResponse.json({ excused: [], skipped: [] });
  }

  const { data: existingLogs } = await supabase
    .from("habit_logs")
    .select("habit_id, date, excused")
    .in(
      "habit_id",
      touchedHabits.map((h) => h.habit.id)
    )
    .gte("date", date_from)
    .lte("date", dateTo);

  const alreadyExcused = new Set(
    (existingLogs ?? []).filter((l) => l.excused).map((l) => `${l.habit_id}:${l.date}`)
  );

  const month = date_from.slice(0, 7);
  const loggedAt = new Date().toISOString();
  const rows: { habit_id: string; date: string; completed: false; excused: true; note: string | null; logged_at: string }[] = [];
  const excused: { habit_id: string; habit_name: string }[] = [];
  const skipped: { habit_id: string; habit_name: string; used: number; cap: number }[] = [];

  for (const { habit, dates } of touchedHabits) {
    // Re-submitting a range that's already fully excused for this habit
    // (e.g. re-opening the dialog on an overlapping range) needs no new
    // use — nothing is actually changing for it.
    const needsNewExcusal = dates.some((d) => !alreadyExcused.has(`${habit.id}:${d}`));

    if (!needsNewExcusal) {
      excused.push({ habit_id: habit.id, habit_name: habit.name });
      continue;
    }

    const { data: quota } = await supabase
      .rpc("check_and_increment_habit_leave", {
        p_user_id: user.id,
        p_habit_id: habit.id,
        p_month: month,
        p_cap: MONTHLY_CAP,
      })
      .single<{ allowed: boolean; used: number; cap: number }>();

    if (!quota?.allowed) {
      skipped.push({ habit_id: habit.id, habit_name: habit.name, used: quota?.used ?? MONTHLY_CAP, cap: MONTHLY_CAP });
      continue;
    }

    for (const d of dates) {
      rows.push({ habit_id: habit.id, date: d, completed: false, excused: true, note: note ?? null, logged_at: loggedAt });
    }
    excused.push({ habit_id: habit.id, habit_name: habit.name });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("habit_logs").upsert(rows, { onConflict: "habit_id,date" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ excused, skipped });
}

// Current month's leave-use count per habit — powers the "X/4 used this
// month" indicator in Manage Habits. Deliberately a separate lightweight
// endpoint rather than joined into GET /api/habits, which is on the hot
// path for every habit page (checklist, grid, dashboard) and shouldn't
// carry a query only the Manage tab needs.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const month = todayLocalISODate().slice(0, 7);
  const { data, error } = await supabase
    .from("habit_leave_usage")
    .select("habit_id, count")
    .eq("user_id", user.id)
    .eq("month", month);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ month, cap: MONTHLY_CAP, usage: data });
}
