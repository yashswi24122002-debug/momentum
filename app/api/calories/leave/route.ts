import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { addDays, lastNMonths, todayLocalISODate } from "@/lib/date";

const MAX_RANGE_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_MONTHS = 6;

// Last HISTORY_MONTHS months of leave days taken, for the history page's
// trend chart — calorie leave has no cap (unlike habits), so this is pure
// history, not a quota/remaining count.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const months = lastNMonths(HISTORY_MONTHS);
  const since = `${months[0]}-01`;

  const { data, error } = await supabase.from("calorie_leave_days").select("date").eq("user_id", user.id).gte("date", since);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const daysByMonth = new Map(months.map((m) => [m, 0]));
  for (const row of data ?? []) {
    const m = (row.date as string).slice(0, 7);
    if (daysByMonth.has(m)) daysByMonth.set(m, daysByMonth.get(m)! + 1);
  }

  return NextResponse.json({ history: months.map((m) => ({ month: m, days: daysByMonth.get(m)! })) });
}

// Marks a date range as "on leave" for calorie tracking — same shape as
// the habit-leave endpoint, so history/dashboard reads can treat these
// days as excused instead of a 0-kcal missed day.
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

  const rows: { user_id: string; date: string; note: string | null }[] = [];
  for (let d = date_from; d <= dateTo; d = addDays(d, 1)) {
    rows.push({ user_id: user.id, date: d, note: note ?? null });
  }

  const { error } = await supabase.from("calorie_leave_days").upsert(rows, { onConflict: "user_id,date" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ marked: rows.length });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !ISO_DATE.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }

  const { error } = await supabase.from("calorie_leave_days").delete().eq("user_id", user.id).eq("date", date);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
