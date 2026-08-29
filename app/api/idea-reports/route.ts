import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table, but needed to render the pipeline board on
// /ideas (grouped by lifecycle_status) without re-deriving it client-side.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  // idea_reports has no user_id of its own — ownership derives from its
  // parent idea, so an explicit idea_id filter is what actually limits this
  // to the caller's own reports (RLS's admin bypass otherwise returns
  // everyone's).
  const { data: myIdeas } = await supabase.from("ideas").select("id").eq("user_id", user.id);
  const ideaIds = (myIdeas ?? []).map((i) => i.id);
  if (ideaIds.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  const { data, error } = await supabase
    .from("idea_reports")
    .select("*, ideas(title, one_liner, category, effort_estimate)")
    .in("idea_id", ideaIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data });
}
