import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";

/** RemoteOK public API — no auth. First array element is a legal-notice object, not a job. */
export async function fetchRemoteOkJobs(): Promise<JobSourceResult> {
  const source = "remoteok";
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "Momentum (personal job search tool)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { source, postings: [], error: `HTTP ${res.status}` };

    const json = await res.json();
    const postings: RawJobPosting[] = (Array.isArray(json) ? json : [])
      .filter((job) => job.id && job.position)
      .map((job) => ({
        source,
        company: job.company ?? "Unknown",
        role_title: job.position,
        location: job.location || null,
        remote: true,
        url: job.url ?? (job.slug ? `https://remoteok.com/remote-jobs/${job.slug}` : null),
        description_raw: job.description ?? null,
        tech_stack_tags: Array.isArray(job.tags) ? job.tags : [],
        posted_date: job.date ? job.date.slice(0, 10) : null,
      }));

    return { source, postings };
  } catch (error) {
    return { source, postings: [], error: error instanceof Error ? error.message : String(error) };
  }
}
