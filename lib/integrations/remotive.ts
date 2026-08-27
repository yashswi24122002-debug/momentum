import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ROLE_KEYWORDS } from "@/lib/jobs/config";

/** Remotive public API — no auth, keyword search. One request per role keyword, run concurrently. */
export async function fetchRemotiveJobs(): Promise<JobSourceResult> {
  const source = "remotive";
  const seen = new Set<string>();
  const errors: string[] = [];

  const perKeyword = await Promise.all(
    ROLE_KEYWORDS.map(async (keyword) => {
      try {
        const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          errors.push(`${keyword}: HTTP ${res.status}`);
          return [];
        }
        const json = await res.json();
        return (json.jobs ?? []) as Record<string, unknown>[];
      } catch (error) {
        errors.push(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    })
  );

  const postings: RawJobPosting[] = [];
  for (const job of perKeyword.flat()) {
    const id = String(job.id);
    if (seen.has(id)) continue;
    seen.add(id);
    postings.push({
      source,
      company: (job.company_name as string) ?? "Unknown",
      role_title: job.title as string,
      location: (job.candidate_required_location as string) || null,
      remote: true,
      url: (job.url as string) ?? null,
      description_raw: (job.description as string) ?? null,
      tech_stack_tags: Array.isArray(job.tags) ? (job.tags as string[]) : [],
      posted_date: job.publication_date ? (job.publication_date as string).slice(0, 10) : null,
    });
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
