import type { SupabaseClient } from "@supabase/supabase-js";
import { todayLocalISODate } from "@/lib/date";
import type { FeatureKey } from "@/lib/types/admin";

export class UsageLimitExceededError extends Error {
  constructor(public limit: number) {
    super(`You've used your ${limit}/day limit for this — try again tomorrow.`);
  }
}

/**
 * 09-Admin-Access-Control-PRD.md §8: checked before every AI call. The
 * admin is never capped (short-circuits before touching either table) —
 * only members have usage_limits rows that matter. `daily_limit` null
 * means unlimited (usage is still counted for visibility, just never
 * blocks). Uses the caller's own RLS-scoped client — usage_counters'
 * policy is a plain own-row check, unlike user_api_keys, so this doesn't
 * need the service-role escape hatch that resolveGeminiApiKey does.
 */
export async function checkAndIncrementUsage(supabase: SupabaseClient, userId: string, featureKey: FeatureKey, isAdmin: boolean): Promise<void> {
  if (isAdmin) return;

  const today = todayLocalISODate();

  const { data: limitRow } = await supabase
    .from("usage_limits")
    .select("daily_limit")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  const dailyLimit: number | null = limitRow?.daily_limit ?? null;

  const { data: counterRow } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .eq("usage_date", today)
    .maybeSingle();
  const currentCount = counterRow?.count ?? 0;

  if (dailyLimit !== null && currentCount >= dailyLimit) {
    throw new UsageLimitExceededError(dailyLimit);
  }

  await supabase
    .from("usage_counters")
    .upsert({ user_id: userId, feature_key: featureKey, usage_date: today, count: currentCount + 1 }, { onConflict: "user_id,feature_key,usage_date" });
}
