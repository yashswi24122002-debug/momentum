import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table, but needed to render the pipeline board on
// /content (grouped by lifecycle_status).
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  // content_reports has no user_id of its own — ownership derives from its
  // parent content idea, so an explicit content_idea_id filter is what
  // actually limits this to the caller's own reports (RLS's admin bypass
  // otherwise returns everyone's).
  const { data: myIdeas } = await supabase.from("content_ideas").select("id").eq("user_id", user.id);
  const ideaIds = (myIdeas ?? []).map((i) => i.id);
  if (ideaIds.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  const { data, error } = await supabase
    .from("content_reports")
    .select("*, content_ideas(title, format)")
    .in("content_idea_id", ideaIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data });
}
