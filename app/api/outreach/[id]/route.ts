import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_STATUSES = ["draft", "approved", "scheduled", "sent", "replied"];

// Handles editing the draft body, and the draft -> approved -> scheduled
// transitions. "sent" is set by the send-scheduled-emails cron itself, not
// through this route, but is left valid here in case of manual correction.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};

  if (typeof body.email_body_final === "string") updates.email_body_final = body.email_body_final;
  if (typeof body.email_subject === "string") updates.email_subject = body.email_subject;
  if (typeof body.contact_email === "string") updates.contact_email = body.contact_email;

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (body.scheduled_send_at !== undefined) {
    updates.scheduled_send_at = body.scheduled_send_at;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("outreach").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ outreach: data });
}
