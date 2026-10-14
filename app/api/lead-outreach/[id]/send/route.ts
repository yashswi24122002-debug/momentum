import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sendEmail } from "@/lib/email/mailer";
import { signAttachment } from "@/lib/email/sign-attachment";
import { plainTextToHtml, stripMarkdownBold } from "@/lib/email/plain-text-to-html";
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

  // The report PDF is rendered client-side (jsPDF) and uploaded ahead of
  // send, same as the Jobs tool's resume/cover-letter PDFs — attach it if
  // one's been generated for this lead's latest audit.
  const { data: audit } = await supabase
    .from("website_audits")
    .select("report_pdf_path")
    .eq("lead_id", lead.id)
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reportAttachment = await signAttachment(supabase, audit?.report_pdf_path ?? null, "website-audit.pdf");

  const result = await sendEmail({
    to: lead.email,
    subject: outreach.pitch_subject,
    html: plainTextToHtml(body),
    text: stripMarkdownBold(body),
    attachments: reportAttachment ? [reportAttachment] : undefined,
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
