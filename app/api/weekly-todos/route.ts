import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { startOfWeekMonday } from "@/lib/date";

// This route always operates on "the current week" (PRD: "Manage current
// week's priority/tasks") — there's no [id] segment. The client always
// supplies its own local `week_start` (computed from the browser's
// timezone); we fall back to the server's clock only if it's omitted, since
// the server's timezone can differ from the user's.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveWeekStart(candidate: string | null): string {
  if (candidate && ISO_DATE.test(candidate)) return candidate;
  return startOfWeekMonday(new Date());
}

// Priority tasks live in weekly_tasks (see 20260908000008), not this row —
// a pending one has no week attached and keeps showing every week until
// done, so it's fetched separately from whichever week's row this is.
export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const weekStart = resolveWeekStart(new URL(request.url).searchParams.get("week_start"));

  const [{ data: weeklyTodo, error: weeklyTodoError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from("weekly_todos").select("*").eq("user_id", user.id).eq("week_start_date", weekStart).maybeSingle(),
    supabase
      .from("weekly_tasks")
      .select("*")
      .eq("user_id", user.id)
      .or(`done.eq.false,done_on_week.eq.${weekStart}`)
      .order("created_at", { ascending: true }),
  ]);

  if (weeklyTodoError) {
    return NextResponse.json({ error: weeklyTodoError.message }, { status: 500 });
  }
  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: weeklyTodo, tasks });
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { top_priority, week_start } = body as { top_priority?: string; week_start?: string };
  const weekStart = resolveWeekStart(week_start ?? null);

  const { data, error } = await supabase
    .from("weekly_todos")
    .upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        ...(top_priority !== undefined && { top_priority }),
      },
      { onConflict: "user_id,week_start_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const weekStart = resolveWeekStart(
    typeof body.week_start === "string" ? body.week_start : null
  );

  if (typeof body.top_priority !== "string") {
    return NextResponse.json({ error: "top_priority (string) is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weekly_todos")
    .upsert(
      { user_id: user.id, week_start_date: weekStart, top_priority: body.top_priority },
      { onConflict: "user_id,week_start_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: data });
}
