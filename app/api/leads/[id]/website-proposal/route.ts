import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Latest proposal for this lead, mirroring app/api/leads/[id]/website-audit's
// GET — a lead has at most one meaningful "current" proposal to show.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data, error } = await supabase
    .from("lead_website_proposals")
    .select("*")
    .eq("lead_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: data });
}

// Sets pdf_path once the client generates the PDF and uploads it —
// mirrors website-audit's PATCH.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { proposal_id, pdf_path } = body as { proposal_id?: string; pdf_path?: string };

  if (!proposal_id || typeof pdf_path !== "string") {
    return NextResponse.json({ error: "proposal_id and pdf_path are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_website_proposals")
    .update({ pdf_path })
    .eq("id", proposal_id)
    .eq("lead_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: data });
}
