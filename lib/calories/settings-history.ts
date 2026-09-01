import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalorieSettings } from "@/lib/types/calories";

/**
 * calorie_settings is append-only (supabase/migrations/20260907000000) — a
 * new row per day the goals actually changed, never overwritten in place —
 * so that changing today's goal never rewrites what applied on a past day.
 * This fetches the full history once so callers can resolve as many dates
 * as they need against it without a query per date.
 */
export async function fetchSettingsHistory(supabase: SupabaseClient, userId: string): Promise<CalorieSettings[]> {
  const { data } = await supabase
    .from("calorie_settings")
    .select("*")
    .eq("user_id", userId)
    .order("effective_from", { ascending: true });
  return (data ?? []) as CalorieSettings[];
}

/**
 * The settings version in effect on `date` — the most recent row on or
 * before it, or the earliest row if `date` predates every version (the
 * best-known goal, since nothing else existed before it).
 */
export function resolveSettingsForDate(history: CalorieSettings[], date: string): CalorieSettings | null {
  if (history.length === 0) return null;
  let best = history[0];
  for (const row of history) {
    if (row.effective_from > date) break;
    best = row;
  }
  return best;
}
