import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const minFitScore = searchParams.get("minFitScore");

  let query = supabase.from("job_postings").select("*").order("fit_score", { ascending: false });
  if (status) query = query.eq("status", status);
  if (minFitScore) query = query.gte("fit_score", Number(minFitScore));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data });
}
