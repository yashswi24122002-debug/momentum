import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ADZUNA_COUNTRY, ROLE_KEYWORDS } from "@/lib/jobs/config";

/** Adzuna job search API — requires app_id + app_key, country-scoped. */
export async function fetchAdzunaJobs(): Promise<JobSourceResult> {
  const source = "adzuna";
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return { source, postings: [], error: "ADZUNA_APP_ID/ADZUNA_APP_KEY not configured" };

  const postings: RawJobPosting[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const keyword of ROLE_KEYWORDS) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(keyword)}&content-type=application/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        errors.push(`${keyword}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      for (const job of json.results ?? []) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        postings.push({
          source,
          company: job.company?.display_name ?? "Unknown",
          role_title: job.title,
          location: job.location?.display_name ?? null,
          remote: /remote/i.test(job.location?.display_name ?? job.title ?? ""),
          url: job.redirect_url ?? null,
          description_raw: job.description ?? null,
          tech_stack_tags: [],
          posted_date: job.created ? job.created.slice(0, 10) : null,
        });
      }
    } catch (error) {
      errors.push(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
