import { ROLE_KEYWORDS, TECH_STACK_KEYWORDS } from "@/lib/jobs/config";
import type { RawJobPosting } from "@/lib/types/jobs";

/**
 * 0-100 fit score from keyword overlap only (no AI call — this runs on every
 * aggregated posting, so it needs to be cheap and deterministic). Weighted
 * toward tech-stack match since that's the stronger signal for "would I
 * actually want this role."
 */
export function computeFitScore(job: RawJobPosting): number {
  const haystack = [job.role_title, job.description_raw ?? "", ...(job.tech_stack_tags ?? [])]
    .join(" ")
    .toLowerCase();

  const roleHits = ROLE_KEYWORDS.filter((k) => haystack.includes(k)).length;
  const techHits = TECH_STACK_KEYWORDS.filter((k) => haystack.includes(k)).length;

  const roleScore = Math.min(1, roleHits / 2) * 40; // any 2+ role keyword hits maxes this out
  const techScore = Math.min(1, techHits / 5) * 60; // 5+ tech keyword hits maxes this out

  return Math.round(roleScore + techScore);
}
