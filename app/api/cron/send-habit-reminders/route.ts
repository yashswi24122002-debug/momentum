import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors/log-error";
import { isScheduledOn } from "@/lib/habits/schedule";
import type { Habit } from "@/lib/types/habits";

const IST_OFFSET_MIN = 330;

// The app is single-timezone for now (Asia/Kolkata) — same fixed-offset
// assumption already made elsewhere (see lib/date.ts's client-side "today"
// pattern). reminder_time is entered and compared in IST.
function nowIST() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ist = new Date(utcMs + IST_OFFSET_MIN * 60_000);
  const date = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(
    ist.getUTCDate()
  ).padStart(2, "0")}`;
  const hhmm = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
  return { date, hhmm };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return NextResponse.json({ error: "VAPID keys are not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createAdminClient();
  const { date, hhmm } = nowIST();

  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select("*")
    .eq("active", true)
    .not("reminder_time", "is", null)
    .not("reminder_style", "is", null)
    .or(`reminder_sent_on.is.null,reminder_sent_on.neq.${date}`);

  if (habitsError) {
    await logError(supabase, "cron/send-habit-reminders", habitsError.message);
    return NextResponse.json({ error: habitsError.message }, { status: 500 });
  }

  let checked = 0;
  let sent = 0;

  for (const habit of (habits ?? []) as Habit[]) {
    if (!isScheduledOn(habit, date)) continue;
    // reminder_time comes back as "HH:MM:SS" — compare on "HH:MM".
    const triggerTime = (habit.reminder_time as string).slice(0, 5);
    if (hhmm < triggerTime) continue;

    checked++;

    let shouldSend = habit.reminder_style === "checkin";
    if (habit.reminder_style === "nudge") {
      const { data: log } = await supabase
        .from("habit_logs")
        .select("completed")
        .eq("habit_id", habit.id)
        .eq("date", date)
        .maybeSingle();
      shouldSend = !log?.completed;
    }

    if (shouldSend) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", habit.user_id);

      const payload = JSON.stringify({
        title: habit.reminder_style === "checkin" ? `Are you ${habit.name}?` : `Time for: ${habit.name}`,
        body:
          habit.reminder_style === "checkin"
            ? "Tap Yes to mark it done, or No to skip."
            : "Not marked done yet today — tap to complete it.",
        habitId: habit.id,
        date,
        style: habit.reminder_style,
      });

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            await logError(supabase, "cron/send-habit-reminders", (err as Error).message, { habitId: habit.id });
          }
        }
      }
    }

    await supabase.from("habits").update({ reminder_sent_on: date }).eq("id", habit.id);
  }

  return NextResponse.json({ checked, sent });
}
