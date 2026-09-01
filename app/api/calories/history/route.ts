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
  const to = todayLocalISODate();
  const from = addDays(to, -(days - 1));

  const [settingsHistory, { data: logs, error }] = await Promise.all([
    fetchSettingsHistory(supabase, user.id),
    supabase
      .from("food_logs")
      .select("logged_on, food_log_items(*)")
      .eq("user_id", user.id)
      .gte("logged_on", from)
      .lte("logged_on", to),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byDate = new Map<string, FoodLogItem[]>();
  for (const log of logs ?? []) {
    const existing = byDate.get(log.logged_on) ?? [];
    byDate.set(log.logged_on, [...existing, ...(log.food_log_items ?? [])]);
  }

  // Each day gets the goal that actually applied to it, not today's —
  // otherwise changing today's goal would visually rewrite every past
  // day's target on this chart too, the exact bug this fixes.
  const days_data = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const totals = sumNutrition(byDate.get(date) ?? []);
    const goal = resolveSettingsForDate(settingsHistory, date)?.daily_calorie_goal ?? null;
    days_data.push({ date, ...totals, goal });
  }

  return NextResponse.json({ days: days_data });
}
