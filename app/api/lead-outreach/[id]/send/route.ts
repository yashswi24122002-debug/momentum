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

  // Both PDFs are rendered client-side (jsPDF) and uploaded ahead of send,
  // same as the Jobs tool's resume/cover-letter PDFs — attach whichever
  // one's been generated for this lead: an audit report if they have a
  // website, a forward-looking proposal if they don't. A lead could in
  // theory have rows in both tables (e.g. existing_website was added
  // after a proposal was already drafted) — the audit always wins since
  // it's the more specific, grounded document once one exists.
  const [{ data: audit }, { data: proposal }] = await Promise.all([
    supabase
      .from("website_audits")
      .select("report_pdf_path")
      .eq("lead_id", lead.id)
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_website_proposals")
      .select("pdf_path")
      .eq("lead_id", lead.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reportAttachment = audit?.report_pdf_path
    ? await signAttachment(supabase, audit.report_pdf_path, "website-audit.pdf")
    : await signAttachment(supabase, proposal?.pdf_path ?? null, "website-proposal.pdf");

  const recipients = [lead.email, ...(outreach.additional_emails ?? [])].filter((e): e is string => Boolean(e?.trim()));

  const result = await sendEmail({
    to: recipients,
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
