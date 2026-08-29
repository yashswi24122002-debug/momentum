import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_STAGES = ["discovered", "reviewing", "applied_emailed", "response", "interview", "offer", "rejected"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.stage !== undefined) {
    if (!VALID_STAGES.includes(body.stage)) {
      return NextResponse.json({ error: `stage must be one of ${VALID_STAGES.join(", ")}` }, { status: 400 });
    }
    updates.stage = body.stage;
  }
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (typeof body.next_action === "string") updates.next_action = body.next_action;
  if (body.next_action_date !== undefined) updates.next_action_date = body.next_action_date;

  const { data, error } = await supabase.from("applications").update(updates).eq("id", id).eq("user_id", user.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data });
}
