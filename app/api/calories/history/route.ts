import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sumNutrition } from "@/lib/calories/nutrition";
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

  const [{ data: settings }, { data: logs, error }] = await Promise.all([
    supabase.from("calorie_settings").select("daily_calorie_goal").eq("user_id", user.id).maybeSingle(),
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

  const days_data = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const totals = sumNutrition(byDate.get(date) ?? []);
    days_data.push({ date, ...totals });
  }

  return NextResponse.json({ days: days_data, goal: settings?.daily_calorie_goal ?? null });
}
