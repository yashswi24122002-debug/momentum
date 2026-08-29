import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const LOOKBACK_ITEMS = 60;
const RECENT_LIMIT = 12;

// Not in the PRD's route table, but PRD §7's "start with favourites and
// recents" quick-add path needs a way to surface recently-logged foods,
// distinct by food_id, most-recent first.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  // food_log_items has no user_id of its own — ownership derives from its
  // parent food_log, so an explicit food_log_id filter is what actually
  // limits "recent" to the caller's own logs (RLS's admin bypass otherwise
  // returns everyone's).
  const { data: myLogs } = await supabase.from("food_logs").select("id").eq("user_id", user.id);
  const logIds = (myLogs ?? []).map((l) => l.id);
  if (logIds.length === 0) {
    return NextResponse.json({ foods: [] });
  }

  const { data: items, error } = await supabase
    .from("food_log_items")
    .select("food_id, created_at")
    .in("food_log_id", logIds)
    .not("food_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(LOOKBACK_ITEMS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const recentFoodIds: string[] = [];
  for (const item of items ?? []) {
    if (!item.food_id || seen.has(item.food_id)) continue;
    seen.add(item.food_id);
    recentFoodIds.push(item.food_id);
    if (recentFoodIds.length >= RECENT_LIMIT) break;
  }

  if (recentFoodIds.length === 0) {
    return NextResponse.json({ foods: [] });
  }

  const { data: foods, error: foodsError } = await supabase
    .from("foods")
    .select("*, food_servings(*)")
    .in("id", recentFoodIds);

  if (foodsError) {
    return NextResponse.json({ error: foodsError.message }, { status: 500 });
  }

  // Preserve most-recent-first order (the `in` query doesn't guarantee it).
  const byId = new Map((foods ?? []).map((f) => [f.id, f]));
  const ordered = recentFoodIds.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ foods: ordered });
}
