import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { sendOutreachEmail } from "@/lib/jobs/send-outreach";
import { logError } from "@/lib/errors/log-error";

// Sends immediately rather than only queuing for the paced cron — for a
// single-user tool approving one email at a time, waiting for the next
// scheduled cron run (once/weekday morning on Vercel Hobby) is worse than
// just sending it now. The cron stays as a catch-all for anything left in
// "approved"/"scheduled" that wasn't sent this way.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: outreach, error: fetchError } = await supabase
    .from("outreach")
    .select("id, contact_email, email_subject, email_body_draft, email_body_final, job_posting_id, resume_id")
    .eq("id", id)
    .single();

  if (fetchError || !outreach) {
    return NextResponse.json({ error: "Outreach not found" }, { status: 404 });
  }

  const result = await sendOutreachEmail(supabase, outreach);

  if (!result.success) {
    await logError(supabase, "outreach/send", result.error, { outreachId: id });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: updated } = await supabase.from("outreach").select("*").eq("id", id).single();

  return NextResponse.json({ outreach: updated });
}
