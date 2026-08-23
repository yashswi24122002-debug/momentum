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

export async function GET(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const weekStart = resolveWeekStart(new URL(request.url).searchParams.get("week_start"));

  const { data, error } = await supabase
    .from("weekly_todos")
    .select("*")
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: data });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { top_priority, top_3_tasks, week_start } = body as {
    top_priority?: string;
    top_3_tasks?: { text: string; done: boolean }[];
    week_start?: string;
  };
  const weekStart = resolveWeekStart(week_start ?? null);

  const { data, error } = await supabase
    .from("weekly_todos")
    .upsert(
      {
        week_start_date: weekStart,
        ...(top_priority !== undefined && { top_priority }),
        ...(top_3_tasks !== undefined && { top_3_tasks }),
      },
      { onConflict: "week_start_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const weekStart = resolveWeekStart(
    typeof body.week_start === "string" ? body.week_start : null
  );
  const updates: Record<string, unknown> = {};

  if (typeof body.top_priority === "string") updates.top_priority = body.top_priority;
  if (Array.isArray(body.top_3_tasks)) updates.top_3_tasks = body.top_3_tasks;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weekly_todos")
    .upsert(
      { week_start_date: weekStart, ...updates },
      { onConflict: "week_start_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ weekly_todo: data });
}
