import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/mailer";

export type JobApplicationRow = {
  id: string;
  contact_email: string | null;
  email_subject: string | null;
  email_body_draft: string | null;
  email_body_final: string | null;
  resume_pdf_path: string | null;
  cover_letter_pdf_path: string | null;
  company: string;
};

export type SendOutreachResult = { success: true } | { success: false; error: string };

const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

/** Signs a documents-bucket path if set, for attaching to the outreach email. */
async function signAttachment(
  supabase: SupabaseClient,
  path: string | null,
  filename: string
): Promise<{ filename: string; path: string } | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ? { filename, path: data.signedUrl } : null;
}

/**
 * Sends the outreach email for one job_applications row — the tailored
 * resume and cover letter PDFs (rendered client-side, uploaded to storage
 * ahead of time) go along as attachments when present.
 */
export async function sendOutreachEmail(
  supabase: SupabaseClient,
  application: JobApplicationRow
): Promise<SendOutreachResult> {
  if (!application.contact_email) return { success: false, error: "No contact email on file" };

  const body = application.email_body_final ?? application.email_body_draft;
  if (!body || !application.email_subject) return { success: false, error: "Missing subject/body" };

  const attachments = (
    await Promise.all([
      signAttachment(supabase, application.resume_pdf_path, "resume.pdf"),
      signAttachment(supabase, application.cover_letter_pdf_path, "cover-letter.pdf"),
    ])
  ).filter((a): a is { filename: string; path: string } => a !== null);

  const result = await sendEmail({
    to: application.contact_email,
    subject: application.email_subject,
    html: body.replace(/\n/g, "<br />"),
    text: body,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (!result.success) return { success: false, error: result.error };

  await supabase
    .from("job_applications")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", application.id);

  return { success: true };
}
