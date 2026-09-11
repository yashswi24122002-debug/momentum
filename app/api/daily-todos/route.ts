import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { todayLocalISODate } from "@/lib/date";

// A pending task has no date attached — it keeps showing up regardless of
// which day it was added, until marked done or deleted. A done task is
// only visible on the day it was completed (done_on); anything done
// before today is cleaned up rather than kept around as history. The
// client supplies its own local "today" (browser timezone); we fall back
// to the server's clock only if it's omitted.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveToday(candidate: string | null): string {
  if (candidate && ISO_DATE.test(candidate)) return candidate;
  return todayLocalISODate();
}

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const today = resolveToday(new URL(request.url).searchParams.get("date"));

  await supabase.from("daily_todos").delete().eq("user_id", user.id).eq("done", true).lt("done_on", today);

  const { data, error } = await supabase
    .from("daily_todos")
    .select("*")
    .eq("user_id", user.id)
    .or(`done.eq.false,done_on.eq.${today}`)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { text } = body as { text?: string };

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("daily_todos")
    .insert({ user_id: user.id, text: text.trim() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
