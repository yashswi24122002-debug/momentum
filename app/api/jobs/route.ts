import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// computeFitScore hard-gates on role title (only real SWE/SDE/frontend/
// backend/full-stack/TPM/FDE titles get inserted at all — see
// lib/jobs/fit-score.ts), so no fit_score floor is needed here by default.
// MAX_RESULTS is still a safety cap against a very large aggregation run.
const DEFAULT_MIN_FIT_SCORE = 0;
const MAX_RESULTS = 300;

export async function GET(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const minFitScoreParam = searchParams.get("minFitScore");
  const minFitScore = minFitScoreParam !== null ? Number(minFitScoreParam) : DEFAULT_MIN_FIT_SCORE;

  // description_raw is only ever read server-side (draft-outreach, the
  // aggregation cron) — excluding it here was the entire fix for this
  // route's 300-row response ballooning to ~300KB for a feed that never
  // renders it.
  let query = supabase
    .from("job_postings")
    .select("id, source, company, role_title, location, remote, url, tech_stack_tags, posted_date, discovered_at, fit_score, status")
    .gte("fit_score", minFitScore)
    .order("fit_score", { ascending: false })
    .limit(MAX_RESULTS);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data });
}
