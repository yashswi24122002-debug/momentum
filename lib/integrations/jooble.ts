import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";
import { ROLE_KEYWORDS } from "@/lib/jobs/config";

/** Jooble search API — POST with an API-key-scoped URL, keyword + location body. One request per role keyword, run concurrently. */
export async function fetchJoobleJobs(): Promise<JobSourceResult> {
  const source = "jooble";
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) return { source, postings: [], error: "JOOBLE_API_KEY not configured" };

  const errors: string[] = [];
  const seen = new Set<string>();

  const perKeyword = await Promise.all(
    ROLE_KEYWORDS.map(async (keyword) => {
      try {
        const res = await fetch(`https://jooble.org/api/${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: keyword, location: "India" }),
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
    const key = (job.link as string) ?? `${job.company}-${job.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    postings.push({
      source,
      company: (job.company as string) || "Unknown",
      role_title: job.title as string,
      location: (job.location as string) || null,
      remote: /remote/i.test((job.location as string) ?? (job.title as string) ?? ""),
      url: (job.link as string) ?? null,
      description_raw: (job.snippet as string) ?? null,
      tech_stack_tags: [],
      posted_date: job.updated ? (job.updated as string).slice(0, 10) : null,
    });
  }

  return { source, postings, error: errors.length > 0 ? errors.join("; ") : undefined };
}
