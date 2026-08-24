import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table, but needed to render the pipeline board on
// /ideas (grouped by lifecycle_status) without re-deriving it client-side.
export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("idea_reports")
    .select("*, ideas(title, one_liner, category, effort_estimate)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data });
}
