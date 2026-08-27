import type { RawJobPosting } from "@/lib/types/jobs";

export type JobSourceResult = { source: string; postings: RawJobPosting[]; error?: string };

/** Greenhouse public Job Board API — no auth, but needs a per-company board slug. */
export async function fetchGreenhouseJobs(companies: string[]): Promise<JobSourceResult> {
  const source = "greenhouse";
  const postings: RawJobPosting[] = [];
  const errors: string[] = [];

  for (const company of companies) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=false`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push(`${company}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      for (const job of json.jobs ?? []) {
        postings.push({
          source,
          company,
          role_title: job.title,
          location: job.location?.name ?? null,
          remote: /remote/i.test(job.location?.name ?? ""),
          url: job.absolute_url ?? null,
          description_raw: null, // content=false keeps the aggregation call light; not needed until outreach drafting
          tech_stack_tags: [],
          posted_date: job.updated_at ? job.updated_at.slice(0, 10) : null,
        });
      }
    } catch (error) {
      errors.push(`${company}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
