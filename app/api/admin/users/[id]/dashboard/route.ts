import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

// Read-only cross-tool detail for one member (09-Admin-Access-Control-
// PRD.md §10) — uses the admin's own session, not service-role. This works
// because every per-user table's RLS policy includes an explicit
// "admin reads all" (or equivalent) select bypass (Phase 2), so the admin's
// normal client can query another user's rows directly; no write path
// exists here at all. Returns full rows (not just counts) so the admin
// dashboard can show real charts (reusing lib/habits/stats.ts against this
// member's own data) and actual approved/rejected items, not just tallies.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const [habits, ideas, contentIdeas, universities, tasks, outreach, foodLogs, calorieSettings] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", id).order("sort_order"),
    supabase.from("ideas").select("*").eq("user_id", id).order("date_generated", { ascending: false }),
    supabase.from("content_ideas").select("*").eq("user_id", id).order("date_generated", { ascending: false }),
    supabase.from("universities").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    supabase
      .from("outreach")
      .select("id, status, sent_at, created_at, job_postings(company, role_title)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("food_logs").select("id, logged_on").eq("user_id", id),
    supabase.from("calorie_settings").select("daily_calorie_goal").eq("user_id", id).maybeSingle(),
  ]);

  // habit_logs has no user_id of its own (Phase 2 §5 Group B — ownership is
  // derived via its parent habit), so it needs an explicit habit_id filter
  // here rather than relying on RLS alone, which would otherwise return
  // every user's logs for an admin session (its policy's `is_admin(...)`
  // clause has no per-member scoping by itself).
  const habitIds = (habits.data ?? []).map((h) => h.id);
  const { data: habitLogs } = habitIds.length
    ? await supabase.from("habit_logs").select("*").in("habit_id", habitIds)
    : { data: [] };

  function countBy<T extends string>(rows: { status: T }[] | null): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }

  return NextResponse.json({
    habits: habits.data ?? [],
    habitLogs: habitLogs ?? [],
    ideas: ideas.data ?? [],
    content: contentIdeas.data ?? [],
    universities: universities.data ?? [],
    tasks: tasks.data ?? [],
    outreach: outreach.data ?? [],
    summary: {
      ideas: countBy(ideas.data),
      content: countBy(contentIdeas.data),
      universities: countBy(universities.data),
      tasks: countBy(tasks.data),
      outreach: countBy(outreach.data),
    },
    calories: {
      totalLogs: foodLogs.data?.length ?? 0,
      distinctDays: new Set((foodLogs.data ?? []).map((f) => f.logged_on)).size,
      dailyGoal: calorieSettings.data?.daily_calorie_goal ?? null,
    },
  });
}
