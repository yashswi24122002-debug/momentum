import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/mailer";
import { addDays, todayLocalISODate } from "@/lib/date";

export type OutreachRow = {
  id: string;
  user_id: string;
  contact_email: string | null;
  email_subject: string | null;
  email_body_draft: string | null;
  email_body_final: string | null;
  job_posting_id: string | null;
  resume_id: string | null;
};

export type SendOutreachResult = { success: true } | { success: false; error: string };

const RESUME_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Shared by the immediate "send now" route and the paced cron — sends via
 * SMTP, marks the row sent, and rolls the job into the applications
 * pipeline. Returns the real SMTP error on failure rather than swallowing
 * it, since a silent failure here is exactly what left outreach looking
 * "sent" when nothing went out.
 */
export async function sendOutreachEmail(
  supabase: SupabaseClient,
  outreach: OutreachRow
): Promise<SendOutreachResult> {
  if (!outreach.contact_email) return { success: false, error: "No contact email on file" };

  const body = outreach.email_body_final ?? outreach.email_body_draft;
  if (!body || !outreach.email_subject) return { success: false, error: "Missing subject/body" };

  let attachments: { filename: string; path: string }[] | undefined;
  if (outreach.resume_id) {
    const { data: resume } = await supabase
      .from("resumes")
      .select("name, file_url")
      .eq("id", outreach.resume_id)
      .single();
    if (resume) {
      const { data: signed } = await supabase.storage
        .from(RESUME_BUCKET)
        .createSignedUrl(resume.file_url, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) {
        attachments = [{ filename: resume.name, path: signed.signedUrl }];
      }
    }
  }

  const result = await sendEmail({
    to: outreach.contact_email,
    subject: outreach.email_subject,
    html: body.replace(/\n/g, "<br />"),
    text: body,
    attachments,
  });
  if (!result.success) return { success: false, error: result.error };

  const nowIso = new Date().toISOString();
  await supabase
    .from("outreach")
    .update({ status: "sent", sent_at: nowIso, follow_up_due: addDays(todayLocalISODate(), 7) })
    .eq("id", outreach.id);

  if (outreach.job_posting_id) {
    const { data: existingApplication } = await supabase
      .from("applications")
      .select("id")
      .eq("job_posting_id", outreach.job_posting_id)
      .maybeSingle();

    if (existingApplication) {
      await supabase
        .from("applications")
        .update({ stage: "applied_emailed", applied_via: "email", updated_at: nowIso })
        .eq("id", existingApplication.id);
    } else {
      // Explicit user_id — this can run via the service-role cron (no
      // session, so no auth.uid() for the column default to fall back on),
      // so it's copied straight from the outreach row instead.
      await supabase
        .from("applications")
        .insert({ job_posting_id: outreach.job_posting_id, user_id: outreach.user_id, stage: "applied_emailed", applied_via: "email" });
    }
  }

  return { success: true };
}
