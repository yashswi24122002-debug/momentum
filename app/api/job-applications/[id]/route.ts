import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data, error } = await supabase.from("job_applications").select("*").eq("id", id).eq("user_id", user.id).single();

  if (error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ application: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.contact_email === "string" || body.contact_email === null) updates.contact_email = body.contact_email;
  if (typeof body.contact_name === "string" || body.contact_name === null) updates.contact_name = body.contact_name;
  if (typeof body.email_subject === "string") updates.email_subject = body.email_subject;
  if (typeof body.email_body_final === "string") updates.email_body_final = body.email_body_final;
  if (typeof body.status === "string") updates.status = body.status;
  // Set once the client has already uploaded the rendered PDF to the
  // documents bucket — this route just records where it landed.
  if (typeof body.resume_pdf_path === "string") updates.resume_pdf_path = body.resume_pdf_path;
  if (typeof body.cover_letter_pdf_path === "string") updates.cover_letter_pdf_path = body.cover_letter_pdf_path;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("job_applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { error } = await supabase.from("job_applications").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
