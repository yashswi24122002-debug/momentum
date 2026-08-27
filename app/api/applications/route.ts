import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("applications")
    .select("*, job_postings(company, role_title, url)")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}

// For applying directly on a company portal (applied_via: "portal") — the
// email path creates its application row automatically once outreach sends.
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { job_posting_id, stage, applied_via, notes } = body as {
    job_posting_id?: string;
    stage?: string;
    applied_via?: string;
    notes?: string;
  };

  if (!job_posting_id || typeof job_posting_id !== "string") {
    return NextResponse.json({ error: "job_posting_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      job_posting_id,
      stage: stage ?? "discovered",
      applied_via: applied_via ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data }, { status: 201 });
}
