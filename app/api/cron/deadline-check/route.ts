import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/mailer";
import { logError } from "@/lib/errors/log-error";
import { todayLocalISODate, parseLocalISODate } from "@/lib/date";
import type { Task } from "@/lib/types/masters-abroad";

const THRESHOLDS = [30, 14, 7, 1] as const;

function daysUntil(deadline: string, today: string): number {
  const ms = parseLocalISODate(deadline).getTime() - parseLocalISODate(today).getTime();
  return Math.round(ms / 86_400_000);
}

function reminderFlag(threshold: (typeof THRESHOLDS)[number]): keyof Task {
  return `reminder_sent_${threshold}` as keyof Task;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayLocalISODate();

  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers();
  const recipient = users?.[0]?.email;

  if (usersError || !recipient) {
    await logError(supabase, "cron/deadline-check", "Could not resolve a recipient email for reminders");
    return NextResponse.json({ error: "No recipient found" }, { status: 500 });
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .not("deadline", "is", null)
    .neq("status", "done");

  if (tasksError) {
    await logError(supabase, "cron/deadline-check", tasksError.message);
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  let sent = 0;
  for (const task of (tasks ?? []) as Task[]) {
    if (!task.deadline) continue;
    const days = daysUntil(task.deadline, today);

    for (const threshold of THRESHOLDS) {
      if (days !== threshold) continue;
      const flag = reminderFlag(threshold);
      if (task[flag]) continue; // already sent for this threshold — idempotent

      const result = await sendEmail({
        to: recipient,
        subject: `Momentum: "${task.title}" is due in ${threshold} day${threshold === 1 ? "" : "s"}`,
        html: `<p><strong>${task.title}</strong> is due on ${task.deadline} — that's ${threshold} day${threshold === 1 ? "" : "s"} from now.</p>${
          task.instructions ? `<p>${task.instructions}</p>` : ""
        }`,
      });

      if (!result.success) {
        await logError(supabase, "cron/deadline-check", result.error, { taskId: task.id, threshold });
        continue;
      }

      await supabase.from("tasks").update({ [flag]: true }).eq("id", task.id);
      await supabase.from("reminder_log").insert({ task_id: task.id, days_before: threshold });
      sent++;
    }
  }

  return NextResponse.json({ checked: tasks?.length ?? 0, sent });
}
