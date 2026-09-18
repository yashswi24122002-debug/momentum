import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const RECENT_LIMIT = 15; // enough recent items to usually surface a few distinct gram amounts

// Powers "remember my usual portion/meal" — the quantity/serving/meal this
// user last logged for this specific food (so re-adding it later defaults
// to that instead of the food's generic catalogue values), plus every
// distinct gram amount they've used for it recently, so the serving
// dropdown can offer "70g", "100g", etc. as quick picks alongside the
// catalogue default and Custom.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  // food_log_items has no user_id of its own — ownership derives from its
  // parent food_log, same pattern as /api/calories/foods/recent.
  const { data: myLogs } = await supabase.from("food_logs").select("id").eq("user_id", user.id);
  const logIds = (myLogs ?? []).map((l) => l.id);
  if (logIds.length === 0) {
    return NextResponse.json({ last: null, recentGrams: [] });
  }

  const { data, error } = await supabase
    .from("food_log_items")
    .select("quantity, serving_label, serving_g, food_logs(meal_type)")
    .eq("food_id", id)
    .in("food_log_id", logIds)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const mostRecent = rows[0]
    ? {
        quantity: rows[0].quantity,
        serving_label: rows[0].serving_label,
        serving_g: rows[0].serving_g,
        meal_type: (rows[0].food_logs as unknown as { meal_type: string } | null)?.meal_type ?? null,
      }
    : null;

  const recentGrams: number[] = [];
  for (const row of rows) {
    if (row.serving_g && !recentGrams.includes(row.serving_g)) recentGrams.push(row.serving_g);
    if (recentGrams.length >= 5) break;
  }

  return NextResponse.json({ last: mostRecent, recentGrams });
}
