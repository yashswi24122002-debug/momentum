import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table, but /ideas/[id] (full report detail view)
// needs to fetch a single idea plus its report.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data, error } = await supabase
    .from("ideas")
    .select("*, idea_reports(*)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  return NextResponse.json({ idea: data });
}

// Only `saved` is mutable here — status changes go through the dedicated
// approve/reject routes since those trigger other side effects (AI report
// generation, requiring a reason).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();

  if (typeof body.saved !== "boolean") {
    return NextResponse.json({ error: "saved (boolean) is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ideas")
    .update({ saved: body.saved })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ idea: data });
}
