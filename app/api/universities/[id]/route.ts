import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_STATUSES = ["researching", "shortlisted", "applying", "applied", "decision"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (typeof body.verified === "boolean") updates.verified = body.verified;
  if (typeof body.deadline_uni_assist === "string" || body.deadline_uni_assist === null) {
    updates.deadline_uni_assist = body.deadline_uni_assist;
  }
  if (typeof body.deadline_direct === "string" || body.deadline_direct === null) {
    updates.deadline_direct = body.deadline_direct;
  }
  if (typeof body.fit_notes === "string" || body.fit_notes === null) updates.fit_notes = body.fit_notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("universities").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ university: data });
}

// Hard delete. Note: tasks scoped to this university (university_id FK)
// cascade-delete too; documents scoped to it just lose the reference
// (on delete set null) rather than being deleted themselves.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("universities").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
