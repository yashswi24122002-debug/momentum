import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";

/** Lever public postings API — no auth, per-company slug. */
export async function fetchLeverJobs(companies: string[]): Promise<JobSourceResult> {
  const source = "lever";
  const postings: RawJobPosting[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push(`${company}: HTTP ${res.status}`);
        continue;
      }
      const jobs = await res.json();
      for (const job of jobs ?? []) {
        postings.push({
          source,
          company,
          role_title: job.text,
          location: job.categories?.location ?? null,
          remote: /remote/i.test(job.categories?.location ?? job.categories?.commitment ?? ""),
          url: job.hostedUrl ?? null,
          description_raw: null,
          tech_stack_tags: [],
          posted_date: job.createdAt ? new Date(job.createdAt).toISOString().slice(0, 10) : null,
        });
      }
    } catch (error) {
      errors.push(`${company}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
