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
  const { date, completed } = body as { date?: string; completed?: boolean };

  if (!date || typeof date !== "string" || typeof completed !== "boolean") {
    return NextResponse.json(
      { error: "date (YYYY-MM-DD) and completed (boolean) are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("habit_logs")
    .upsert(
      { habit_id: id, date, completed, logged_at: new Date().toISOString() },
      { onConflict: "habit_id,date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}
