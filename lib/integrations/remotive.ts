import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ROLE_KEYWORDS } from "@/lib/jobs/config";

/** Remotive public API — no auth, keyword search. */
export async function fetchRemotiveJobs(): Promise<JobSourceResult> {
  const source = "remotive";
  const postings: RawJobPosting[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const keyword of ROLE_KEYWORDS) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push(`${keyword}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      for (const job of json.jobs ?? []) {
        if (seen.has(String(job.id))) continue;
        seen.add(String(job.id));
        postings.push({
          source,
          company: job.company_name ?? "Unknown",
          role_title: job.title,
          location: job.candidate_required_location || null,
          remote: true,
          url: job.url ?? null,
          description_raw: job.description ?? null,
          tech_stack_tags: Array.isArray(job.tags) ? job.tags : [],
          posted_date: job.publication_date ? job.publication_date.slice(0, 10) : null,
        });
      }
    } catch (error) {
      errors.push(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
