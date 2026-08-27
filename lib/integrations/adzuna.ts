import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ADZUNA_COUNTRY, ROLE_KEYWORDS } from "@/lib/jobs/config";

/**
 * Adzuna job search API — requires app_id + app_key, country-scoped.
 * Sequential, not concurrent, per keyword — Adzuna's free tier 429s under
 * concurrent load (confirmed live), unlike the other keyword-search sources.
 */
export async function fetchAdzunaJobs(): Promise<JobSourceResult> {
  const source = "adzuna";
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return { source, postings: [], error: "ADZUNA_APP_ID/ADZUNA_APP_KEY not configured" };

  const errors: string[] = [];
  const seen = new Set<string>();
  const allResults: Record<string, unknown>[] = [];

  for (const keyword of ROLE_KEYWORDS) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(keyword)}&content-type=application/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        errors.push(`${keyword}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      allResults.push(...((json.results ?? []) as Record<string, unknown>[]));
    } catch (error) {
      errors.push(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const postings: RawJobPosting[] = [];
  for (const job of allResults) {
    const id = job.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const company = job.company as { display_name?: string } | undefined;
    const location = job.location as { display_name?: string } | undefined;
    postings.push({
      source,
      company: company?.display_name ?? "Unknown",
      role_title: job.title as string,
      location: location?.display_name ?? null,
      remote: /remote/i.test(location?.display_name ?? (job.title as string) ?? ""),
      url: (job.redirect_url as string) ?? null,
      description_raw: (job.description as string) ?? null,
      tech_stack_tags: [],
      posted_date: job.created ? (job.created as string).slice(0, 10) : null,
    });
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
