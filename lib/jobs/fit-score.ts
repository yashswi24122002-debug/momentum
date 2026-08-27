import { ROLE_KEYWORDS, TECH_STACK_KEYWORDS } from "@/lib/jobs/config";
import type { RawJobPosting } from "@/lib/types/jobs";

/**
 * 0-100 fit score from keyword overlap only (no AI call — this runs on every
 * aggregated posting, so it needs to be cheap and deterministic).
 *
 * Hard-gated on the role title actually matching one of ROLE_KEYWORDS —
 * without this, a "DevOps Engineer" or "Sales Engineer" posting whose
 * description happens to mention React/Node would still score high on tech
 * overlap alone despite being the wrong job entirely. Only postings that
 * pass the role gate get ranked further by tech-stack match.
 */
export function computeFitScore(job: RawJobPosting): number {
  const roleTitle = job.role_title.toLowerCase();
  const isMatchingRole = ROLE_KEYWORDS.some((k) => roleTitle.includes(k));
  if (!isMatchingRole) return 0;

  const haystack = [job.role_title, job.description_raw ?? "", ...(job.tech_stack_tags ?? [])]
    .join(" ")
    .toLowerCase();
  const techHits = TECH_STACK_KEYWORDS.filter((k) => haystack.includes(k)).length;

  const baseScore = 40; // role already matched
  const techScore = Math.min(1, techHits / 5) * 60; // 5+ tech keyword hits maxes this out

  return Math.round(baseScore + techScore);
}
