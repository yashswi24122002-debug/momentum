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
