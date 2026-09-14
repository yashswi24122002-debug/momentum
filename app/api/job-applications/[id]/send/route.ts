import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sendOutreachEmail } from "@/lib/jobs/send-outreach";
import { logError } from "@/lib/errors/log-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, contact_email, email_subject, email_body_draft, email_body_final, resume_pdf_path, cover_letter_pdf_path, company")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const result = await sendOutreachEmail(supabase, application);
  if (!result.success) {
    await logError(supabase, "job-applications/send", result.error, { applicationId: id });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: updated } = await supabase.from("job_applications").select("*").eq("id", id).single();
  return NextResponse.json({ application: updated });
}
