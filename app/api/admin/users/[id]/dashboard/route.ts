import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

// Read-only cross-tool summary for one member (09-Admin-Access-Control-
// PRD.md §10) — uses the admin's own session, not service-role. This works
// because every per-user table's RLS policy includes an explicit
// "admin reads all" (or equivalent) select bypass (Phase 2), so the admin's
// normal client can query another user's rows directly; no write path
// exists here at all.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const [habits, ideas, contentIdeas, universities, tasks, jobPostingsOutreach, foodLogs, calorieSettings] = await Promise.all([
    supabase.from("habits").select("id, active").eq("user_id", id),
    supabase.from("ideas").select("status").eq("user_id", id),
    supabase.from("content_ideas").select("status").eq("user_id", id),
    supabase.from("universities").select("status").eq("user_id", id),
    supabase.from("tasks").select("status").eq("user_id", id),
    supabase.from("outreach").select("status").eq("user_id", id),
    supabase.from("food_logs").select("id, logged_on").eq("user_id", id),
    supabase.from("calorie_settings").select("daily_calorie_goal").eq("user_id", id).maybeSingle(),
  ]);

  function countBy<T extends string>(rows: { status: T }[] | null): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }

  return NextResponse.json({
    habits: {
      total: habits.data?.length ?? 0,
      active: habits.data?.filter((h) => h.active).length ?? 0,
    },
    ideas: countBy(ideas.data),
    content: countBy(contentIdeas.data),
    universities: countBy(universities.data),
    tasks: countBy(tasks.data),
    outreach: countBy(jobPostingsOutreach.data),
    calories: {
      totalLogs: foodLogs.data?.length ?? 0,
      distinctDays: new Set((foodLogs.data ?? []).map((f) => f.logged_on)).size,
      dailyGoal: calorieSettings.data?.daily_calorie_goal ?? null,
    },
  });
}
