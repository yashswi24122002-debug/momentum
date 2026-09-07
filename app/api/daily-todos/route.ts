import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { todayLocalISODate } from "@/lib/date";

// Always operates on "today" — no [id] segment, no way to read a past
// date. The client supplies its own local `date` (browser timezone); we
// fall back to the server's clock only if it's omitted.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveDate(candidate: string | null): string {
  if (candidate && ISO_DATE.test(candidate)) return candidate;
  return todayLocalISODate();
}

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const date = resolveDate(new URL(request.url).searchParams.get("date"));

  // No history is ever wanted for this feature — clear out anything
  // before today instead of just leaving it unreachable.
  await supabase.from("daily_todos").delete().eq("user_id", user.id).lt("date", date);

  const { data, error } = await supabase
    .from("daily_todos")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ daily_todo: data });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { tasks, date: dateParam } = body as { tasks?: { text: string; done: boolean }[]; date?: string };

  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks (array) is required" }, { status: 400 });
  }

  const date = resolveDate(typeof dateParam === "string" ? dateParam : null);

  const { data, error } = await supabase
    .from("daily_todos")
    .upsert({ user_id: user.id, date, tasks }, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ daily_todo: data });
}
