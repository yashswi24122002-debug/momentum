import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";

/** Arbeitnow public job board API — no auth, single page of recent postings. */
export async function fetchArbeitnowJobs(): Promise<JobSourceResult> {
  const source = "arbeitnow";
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { source, postings: [], error: `HTTP ${res.status}` };

    const json = await res.json();
    const postings: RawJobPosting[] = (json.data ?? []).map((job: Record<string, unknown>) => ({
      source,
      company: (job.company_name as string) ?? "Unknown",
      role_title: job.title as string,
      location: (job.location as string) || null,
      remote: Boolean(job.remote),
      url: (job.url as string) ?? null,
      description_raw: (job.description as string) ?? null,
      tech_stack_tags: Array.isArray(job.tags) ? (job.tags as string[]) : [],
      posted_date: job.created_at ? new Date((job.created_at as number) * 1000).toISOString().slice(0, 10) : null,
    }));

    return { source, postings };
  } catch (error) {
    return { source, postings: [], error: error instanceof Error ? error.message : String(error) };
  }
}
