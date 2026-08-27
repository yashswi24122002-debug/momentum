import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { logError } from "@/lib/errors/log-error";
import { addDays, todayLocalISODate } from "@/lib/date";

// Pacing (Master PRD: "send a few outreach emails per hour during work
// hours, not all at once") comes from running this hourly (see vercel.json)
// and only ever sending BATCH_SIZE per run — no separate scheduling
// algorithm needed. An outreach row becomes eligible the moment it's
// "approved" (send now) or "scheduled" with a past-due scheduled_send_at.
const BATCH_SIZE = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: dueError } = await supabase
    .from("outreach")
    .select("*, job_postings(company, role_title)")
    .in("status", ["approved", "scheduled"])
    .or(`scheduled_send_at.is.null,scheduled_send_at.lte.${nowIso}`)
    .order("scheduled_send_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (dueError) {
    await logError(supabase, "cron/send-scheduled-emails", dueError.message);
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  let sent = 0;
  for (const outreach of due ?? []) {
    if (!outreach.contact_email) {
      await logError(supabase, "cron/send-scheduled-emails", "Skipped — no contact email on file", { outreachId: outreach.id });
      continue;
    }

    const body = outreach.email_body_final ?? outreach.email_body_draft;
    if (!body || !outreach.email_subject) {
      await logError(supabase, "cron/send-scheduled-emails", "Skipped — missing subject/body", { outreachId: outreach.id });
      continue;
    }

    const result = await sendEmail({
      to: outreach.contact_email,
      subject: outreach.email_subject,
      html: body.replace(/\n/g, "<br />"),
    });

    if (!result.success) {
      await logError(supabase, "cron/send-scheduled-emails", result.error, { outreachId: outreach.id });
      continue;
    }

    await supabase
      .from("outreach")
      .update({
        status: "sent",
        sent_at: nowIso,
        follow_up_due: addDays(todayLocalISODate(), 7),
      })
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
        await supabase
          .from("applications")
          .insert({ job_posting_id: outreach.job_posting_id, stage: "applied_emailed", applied_via: "email" });
      }
    }

    sent++;
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent });
}
