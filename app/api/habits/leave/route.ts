import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { isScheduledOn } from "@/lib/habits/schedule";
import { addDays, todayLocalISODate } from "@/lib/date";

const MAX_RANGE_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    .select("id, frequency_days")
    .eq("user_id", user.id)
    .eq("active", true);

  if (habitsError) {
    return NextResponse.json({ error: habitsError.message }, { status: 500 });
  }

  const rows: { habit_id: string; date: string; completed: false; excused: true; note: string | null; logged_at: string }[] = [];
  const loggedAt = new Date().toISOString();
  for (let d = date_from; d <= dateTo; d = addDays(d, 1)) {
    for (const habit of habits ?? []) {
      if (!isScheduledOn(habit, d)) continue;
      rows.push({ habit_id: habit.id, date: d, completed: false, excused: true, note: note ?? null, logged_at: loggedAt });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ marked: 0 });
  }

  const { error } = await supabase.from("habit_logs").upsert(rows, { onConflict: "habit_id,date" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ marked: rows.length });
}
