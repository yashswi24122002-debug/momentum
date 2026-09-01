import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sumNutrition } from "@/lib/calories/nutrition";
import { fetchSettingsHistory, resolveSettingsForDate } from "@/lib/calories/settings-history";
import { todayLocalISODate } from "@/lib/date";
import { MEAL_TYPE_ORDER } from "@/lib/calories/ui";
import type { FoodLogItem, MealType } from "@/lib/types/calories";

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? todayLocalISODate();

  const [settingsHistory, { data: logs, error: logsError }] = await Promise.all([
    fetchSettingsHistory(supabase, user.id),
    supabase
      .from("food_logs")
      .select("*, food_log_items(*)")
      .eq("user_id", user.id)
      .eq("logged_on", date)
      .order("logged_at", { ascending: true }),
  ]);
  const settings = resolveSettingsForDate(settingsHistory, date);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  const allItems: FoodLogItem[] = (logs ?? []).flatMap((l) => l.food_log_items ?? []);
  const consumed = sumNutrition(allItems);

  const mealGroups = MEAL_TYPE_ORDER.map((mealType: MealType) => {
    const mealsOfType = (logs ?? []).filter((l) => l.meal_type === mealType);
    const items = mealsOfType.flatMap((l) => l.food_log_items ?? []);
    return {
      meal_type: mealType,
      logs: mealsOfType,
      totals: sumNutrition(items),
    };
  }).filter((g) => g.logs.length > 0);

  const remaining = settings ? settings.daily_calorie_goal - consumed.kcal : null;

  return NextResponse.json({
    date,
    settings,
    consumed,
    remaining,
    mealGroups,
  });
}
