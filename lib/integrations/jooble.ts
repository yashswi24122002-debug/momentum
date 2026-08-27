import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ROLE_KEYWORDS } from "@/lib/jobs/config";

/** Jooble search API — POST with an API-key-scoped URL, keyword + location body. */
export async function fetchJoobleJobs(): Promise<JobSourceResult> {
  const source = "jooble";
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) return { source, postings: [], error: "JOOBLE_API_KEY not configured" };

  const postings: RawJobPosting[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const keyword of ROLE_KEYWORDS) {
    try {
      const res = await fetch(`https://jooble.org/api/${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keyword, location: "India" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push(`${keyword}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      for (const job of json.jobs ?? []) {
        const key = job.link ?? `${job.company}-${job.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        postings.push({
          source,
          company: job.company || "Unknown",
          role_title: job.title,
          location: job.location || null,
          remote: /remote/i.test(job.location ?? job.title ?? ""),
          url: job.link ?? null,
          description_raw: job.snippet ?? null,
          tech_stack_tags: [],
          posted_date: job.updated ? job.updated.slice(0, 10) : null,
        });
      }
    } catch (error) {
      errors.push(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
