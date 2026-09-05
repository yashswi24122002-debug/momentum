import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sumNutrition } from "@/lib/calories/nutrition";
import { fetchSettingsHistory, resolveSettingsForDate } from "@/lib/calories/settings-history";
import { addDays, todayLocalISODate } from "@/lib/date";
import type { FoodLogItem } from "@/lib/types/calories";

const DEFAULT_DAYS = 30;

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? DEFAULT_DAYS);
  // "today" from the caller's own browser clock when given — the server
  // runs in UTC, which can be a calendar day behind a user well east of it
  // (e.g. IST) for several hours around their local midnight.
  const toParam = searchParams.get("to");
  const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : todayLocalISODate();
  const from = addDays(to, -(days - 1));

  const [settingsHistory, { data: logs, error }, { data: leaveRows }] = await Promise.all([
    fetchSettingsHistory(supabase, user.id),
    supabase
      .from("food_logs")
      .select("logged_on, food_log_items(*)")
      .eq("user_id", user.id)
      .gte("logged_on", from)
      .lte("logged_on", to),
    supabase.from("calorie_leave_days").select("date").eq("user_id", user.id).gte("date", from).lte("date", to),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byDate = new Map<string, FoodLogItem[]>();
  for (const log of logs ?? []) {
    const existing = byDate.get(log.logged_on) ?? [];
    byDate.set(log.logged_on, [...existing, ...(log.food_log_items ?? [])]);
  }
  const leaveDates = new Set((leaveRows ?? []).map((r) => r.date));

  // Each day gets the goal that actually applied to it, not today's —
  // otherwise changing today's goal would visually rewrite every past
  // day's target on this chart too, the exact bug this fixes. A leave day
  // reports `leave: true` and a null goal/macros — a day someone was away,
  // not a day they failed to hit a goal.
  const days_data = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const leave = leaveDates.has(date);
    const totals = sumNutrition(byDate.get(date) ?? []);
    const settings = resolveSettingsForDate(settingsHistory, date);
    days_data.push({
      date,
      leave,
      kcal: leave ? null : totals.kcal,
      protein_g: leave ? null : totals.protein_g,
      carbs_g: leave ? null : totals.carbs_g,
      fat_g: leave ? null : totals.fat_g,
      goal: settings?.daily_calorie_goal ?? null,
      protein_goal_g: settings?.protein_goal_g ?? null,
      carbs_goal_g: settings?.carbs_goal_g ?? null,
      fat_goal_g: settings?.fat_goal_g ?? null,
    });
  }

  return NextResponse.json({ days: days_data });
}
