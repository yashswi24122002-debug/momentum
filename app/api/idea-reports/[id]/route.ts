import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_STATUSES = ["backlog", "researching", "building", "shipped", "abandoned"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const { lifecycle_status } = body as { lifecycle_status?: string };

  if (!lifecycle_status || !VALID_STATUSES.includes(lifecycle_status)) {
    return NextResponse.json(
      { error: `lifecycle_status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("idea_reports")
    .update({ lifecycle_status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, ideas(title, one_liner, category, effort_estimate)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report: data });
}
