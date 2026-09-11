import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { todayLocalISODate } from "@/lib/date";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { done, date } = body as { done?: boolean; date?: string };

  if (typeof done !== "boolean") {
    return NextResponse.json({ error: "done (boolean) is required" }, { status: 400 });
  }

  const today = date && ISO_DATE.test(date) ? date : todayLocalISODate();

  const { data, error } = await supabase
    .from("daily_todos")
    .update({ done, done_on: done ? today : null })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { error } = await supabase.from("daily_todos").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
