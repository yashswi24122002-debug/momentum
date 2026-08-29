import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { isTaskBlocked } from "@/lib/masters-abroad/dependencies";
import type { Task } from "@/lib/types/masters-abroad";

const VALID_STATUSES = ["not_started", "in_progress", "blocked", "done"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    // PRD acceptance criteria: a task with unmet dependencies can't be
    // marked done — enforced server-side too, not just in the UI.
    if (body.status === "done") {
      const { data: current } = await supabase.from("tasks").select("depends_on").eq("id", id).eq("user_id", user.id).single();
      const { data: allTasks } = await supabase.from("tasks").select("*").eq("user_id", user.id);
      if (current && allTasks && isTaskBlocked(current, allTasks as Task[])) {
        return NextResponse.json(
          { error: "This task has unfinished dependencies and can't be marked done yet." },
          { status: 400 }
        );
      }
    }

    updates.status = body.status;
    updates.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  if (typeof body.deadline === "string" || body.deadline === null) updates.deadline = body.deadline;
  if (typeof body.instructions === "string" || body.instructions === null) updates.instructions = body.instructions;
  if (typeof body.where_to_apply_url === "string" || body.where_to_apply_url === null) {
    updates.where_to_apply_url = body.where_to_apply_url;
  }
  if (typeof body.university_id === "string" || body.university_id === null) updates.university_id = body.university_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).eq("user_id", user.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
