import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors/log-error";
import { fetchGreenhouseJobs } from "@/lib/integrations/greenhouse";
import { fetchLeverJobs } from "@/lib/integrations/lever";
import { fetchRemoteOkJobs } from "@/lib/integrations/remoteok";
import { fetchRemotiveJobs } from "@/lib/integrations/remotive";
import { fetchArbeitnowJobs } from "@/lib/integrations/arbeitnow";
import { fetchAdzunaJobs } from "@/lib/integrations/adzuna";
import { fetchJoobleJobs } from "@/lib/integrations/jooble";
import { GREENHOUSE_COMPANIES, LEVER_COMPANIES } from "@/lib/jobs/config";
import { computeFitScore } from "@/lib/jobs/fit-score";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";

function dedupeKey(company: string, roleTitle: string, source: string): string {
  return `${source}::${company.trim().toLowerCase()}::${roleTitle.trim().toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const results = await Promise.all([
    fetchGreenhouseJobs(GREENHOUSE_COMPANIES),
    fetchLeverJobs(LEVER_COMPANIES),
    fetchRemoteOkJobs(),
    fetchRemotiveJobs(),
    fetchArbeitnowJobs(),
    fetchAdzunaJobs(),
    fetchJoobleJobs(),
  ]);

  for (const result of results as JobSourceResult[]) {
    if (result.error) {
      await logError(supabase, "cron/aggregate-jobs", `${result.source}: ${result.error}`);
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("job_postings")
    .select("company, role_title, source");

  if (existingError) {
    await logError(supabase, "cron/aggregate-jobs", existingError.message);
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const seen = new Set(
    (existing ?? []).map((j) => dedupeKey(j.company, j.role_title, j.source))
  );

  const toInsert = [];
  for (const result of results as JobSourceResult[]) {
    for (const job of result.postings) {
      const key = dedupeKey(job.company, job.role_title, job.source);
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        source: job.source,
        company: job.company,
        role_title: job.role_title,
        location: job.location,
        remote: job.remote,
        url: job.url,
        description_raw: job.description_raw,
        tech_stack_tags: job.tech_stack_tags,
        posted_date: job.posted_date,
        fit_score: computeFitScore(job),
        status: "new" as const,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("job_postings").insert(toInsert);
    if (insertError) {
      await logError(supabase, "cron/aggregate-jobs", insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    fetched: (results as JobSourceResult[]).reduce((sum, r) => sum + r.postings.length, 0),
    inserted: toInsert.length,
    sourceErrors: (results as JobSourceResult[]).filter((r) => r.error).map((r) => r.source),
  });
}
