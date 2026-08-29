import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Fetch logs for a date range — powers the grid view and dashboard charts.
export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
  }

  // habit_logs has no user_id of its own — its RLS policy's `is_admin(...)`
  // clause returns every user's logs to an admin session with no per-row
  // scoping, so the habit_id filter here is what actually keeps "my own
  // logs" limited to the caller's own habits (see admin dashboard route
  // for the same pattern).
  const { data: myHabits } = await supabase.from("habits").select("id").eq("user_id", user.id);
  const habitIds = (myHabits ?? []).map((h) => h.id);
  if (habitIds.length === 0) {
    return NextResponse.json({ logs: [] });
  }

  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .in("habit_id", habitIds)
    .gte("date", from)
    .lte("date", to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
