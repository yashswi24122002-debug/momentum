import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors/log-error";
import { sendOutreachEmail } from "@/lib/jobs/send-outreach";

// Catch-all for anything not sent immediately via /api/outreach/[id]/send
// (e.g. a transient failure, or a future scheduled_send_at). Master PRD:
// "send a few outreach emails per hour during work hours, not all at once."
// Vercel Hobby only allows daily crons (confirmed live — an hourly schedule
// was rejected in production), so true hour-by-hour pacing isn't available
// on this plan. This runs once/weekday morning instead and staggers sends
// within that single run (SEND_DELAY_MS apart) so it isn't a single burst —
// upgrade to Pro and add back an hourly vercel.json schedule for real
// inter-hour pacing.
const BATCH_SIZE = 10;
const SEND_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: dueError } = await supabase
    .from("outreach")
    .select("id, contact_email, email_subject, email_body_draft, email_body_final, job_posting_id")
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
    if (sent > 0) await sleep(SEND_DELAY_MS);

    const result = await sendOutreachEmail(supabase, outreach);
    if (!result.success) {
      await logError(supabase, "cron/send-scheduled-emails", result.error, { outreachId: outreach.id });
      continue;
    }
    sent++;
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent });
}
