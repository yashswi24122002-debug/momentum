import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Powers "remember my usual portion" — the quantity/serving this user last
// logged for this specific food, so re-adding it later defaults to that
// instead of the food's generic catalogue serving size.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  // food_log_items has no user_id of its own — ownership derives from its
  // parent food_log, same pattern as /api/calories/foods/recent.
  const { data: myLogs } = await supabase.from("food_logs").select("id").eq("user_id", user.id);
  const logIds = (myLogs ?? []).map((l) => l.id);
  if (logIds.length === 0) {
    return NextResponse.json({ last: null });
  }

  const { data, error } = await supabase
    .from("food_log_items")
    .select("quantity, serving_label, serving_g")
    .eq("food_id", id)
    .in("food_log_id", logIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ last: data });
}
