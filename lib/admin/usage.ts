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
 *
 * `weight` is how many items this single call is about to produce (e.g.
 * ideas/generate always makes exactly 5 ideas in one shot) — the admin's
 * daily cap is a count of *items*, not *button clicks*, so a batch call
 * must consume `weight` of the quota, not 1, or a cap of 5 would let
 * through 5 full batches (25 ideas) instead of 5 ideas. A cap that isn't a
 * multiple of the batch size will block entirely rather than allow a
 * partial (over-cap) batch through — these routes only know how to
 * generate a full fixed-size batch, not a truncated one.
 */
export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  userId: string,
  featureKey: FeatureKey,
  isAdmin: boolean,
  weight = 1
): Promise<void> {
  if (isAdmin) return;

  const today = todayLocalISODate();

  // Was 3 sequential round trips (select limit, select counter, upsert
  // counter) — a real cost on top of an already-slow free-tier Supabase
  // project, on every single AI call. check_and_increment_usage() does the
  // whole read-check-write in one round trip via RPC.
  const { data, error } = await supabase
    .rpc("check_and_increment_usage", {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_weight: weight,
      p_today: today,
    })
    .single<{ allowed: boolean; daily_limit: number | null; new_count: number }>();

  if (error) throw error;
  if (!data.allowed) {
    throw new UsageLimitExceededError(data.daily_limit!);
  }
}
