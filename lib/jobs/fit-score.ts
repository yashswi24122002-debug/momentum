import { ROLE_KEYWORDS, EXCLUDE_TITLE_KEYWORDS, TECH_STACK_KEYWORDS, USER_YEARS_EXPERIENCE, YOE_TOLERANCE_YEARS } from "@/lib/jobs/config";
import { extractMinYearsExperience } from "@/lib/jobs/extract-experience";
import type { RawJobPosting } from "@/lib/types/jobs";

/**
 * 0-100 fit score from keyword overlap only (no AI call — this runs on every
 * aggregated posting, so it needs to be cheap and deterministic).
 *
 * Hard-gated on three things, any of which zeroes the score entirely:
 * 1. Role title actually matching one of ROLE_KEYWORDS — without this, a
 *    "DevOps Engineer" or "Sales Engineer" posting whose description
 *    happens to mention React/Node would still score high on tech overlap
 *    alone despite being the wrong job entirely.
 * 2. Role title not matching EXCLUDE_TITLE_KEYWORDS — plain substring
 *    matching in (1) has a false positive ("engineering" contains
 *    "engineer" as a prefix, so "Software Engineering Director" matches
 *    "software engineer"), so leadership/too-senior titles are excluded
 *    as a whole-word check regardless.
 * 3. Required years of experience not exceeding USER_YEARS_EXPERIENCE by
 *    more than YOE_TOLERANCE_YEARS — hiring.cafe supplies this as
 *    structured data (min_years_experience); every other source falls back
 *    to a regex extraction off description_raw, which is a heuristic and
 *    can occasionally misfire in either direction.
 *
 * Only postings that pass all three gates get ranked further by tech-stack match.
 */
export function computeFitScore(job: RawJobPosting): number {
  const roleTitle = job.role_title.toLowerCase();

  const isExcludedTitle = EXCLUDE_TITLE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`, "i").test(roleTitle));
  if (isExcludedTitle) return 0;

  const isMatchingRole = ROLE_KEYWORDS.some((k) => roleTitle.includes(k));
  if (!isMatchingRole) return 0;

  const requiredYoe = job.min_years_experience ?? extractMinYearsExperience(job.description_raw);
  if (requiredYoe !== null && requiredYoe !== undefined && requiredYoe > USER_YEARS_EXPERIENCE + YOE_TOLERANCE_YEARS) {
    return 0;
  }

  const haystack = [job.role_title, job.description_raw ?? "", ...(job.tech_stack_tags ?? [])]
    .join(" ")
    .toLowerCase();
  const techHits = TECH_STACK_KEYWORDS.filter((k) => haystack.includes(k)).length;

  const baseScore = 40; // role (and experience level) already matched
  const techScore = Math.min(1, techHits / 5) * 60; // 5+ tech keyword hits maxes this out

  return Math.round(baseScore + techScore);
}
