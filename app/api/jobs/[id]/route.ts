import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_STATUSES = ["new", "reviewed", "dismissed"];

// Not in the PRD's route table as a dedicated endpoint, but the feed needs a
// way to mark a posting "reviewed" (looked at, not acting on it yet) as well
// as "dismissed" — same shape, so one PATCH route handles both.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_postings")
    .update({ status: body.status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("job_postings").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
