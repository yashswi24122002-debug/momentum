import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const { date, completed, excused, note } = body as {
    date?: string;
    completed?: boolean;
    excused?: boolean;
    note?: string | null;
  };

  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { habit_id: id, date, logged_at: new Date().toISOString() };
  if (typeof completed === "boolean") patch.completed = completed;
  if (typeof excused === "boolean") patch.excused = excused;
  if (typeof note === "string" || note === null) patch.note = note;

  if (!("completed" in patch) && !("excused" in patch) && !("note" in patch)) {
    return NextResponse.json(
      { error: "at least one of completed, excused, note is required" },
      { status: 400 }
    );
  }

  // completed and excused are mutually exclusive states for a given day.
  if (patch.completed === true) patch.excused = false;
  if (patch.excused === true) patch.completed = false;

  const { data, error } = await supabase
    .from("habit_logs")
    .upsert(patch, { onConflict: "habit_id,date" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}
