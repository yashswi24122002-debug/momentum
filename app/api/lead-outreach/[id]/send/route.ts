import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sendEmail } from "@/lib/email/mailer";
import { logError } from "@/lib/errors/log-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: outreach, error: fetchError } = await supabase
    .from("lead_outreach")
    .select("*, business_leads(id, email, name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !outreach) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lead = outreach.business_leads as { id: string; email: string | null; name: string } | null;
  const body = outreach.pitch_body_final ?? outreach.pitch_body_draft;

  if (!lead?.email) {
    return NextResponse.json({ error: "This lead has no email on file" }, { status: 400 });
  }
  if (!body || !outreach.pitch_subject) {
    return NextResponse.json({ error: "Missing subject/body" }, { status: 400 });
  }

  const result = await sendEmail({
    to: lead.email,
    subject: outreach.pitch_subject,
    html: body.replace(/\n/g, "<br />"),
    text: body,
  });

  if (!result.success) {
    await logError(supabase, "lead-outreach/send", result.error, { outreachId: id });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated } = await supabase
    .from("lead_outreach")
    .update({ status: "sent", sent_at: nowIso })
    .eq("id", id)
    .select()
    .single();

  await supabase.from("business_leads").update({ status: "contacted" }).eq("id", lead.id).eq("user_id", user.id);

  return NextResponse.json({ outreach: updated });
}
