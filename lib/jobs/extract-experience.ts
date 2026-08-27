/**
 * Best-effort regex extraction of a minimum years-of-experience requirement
 * from free-text job descriptions, for the sources that don't provide it as
 * structured data (everything except hiring.cafe). Takes the smallest
 * number found across all "N years [of] experience" mentions — errs toward
 * being permissive (under-excluding) rather than aggressively hiding a job
 * over one ambiguous phrase, since this is a heuristic on unstructured text
 * and will occasionally misfire either way.
 */
export function extractMinYearsExperience(text: string | null): number | null {
  if (!text) return null;

  // Several sources return HTML/HTML-entity-escaped descriptions
  // (Arbeitnow, Remotive) — strip tags and decode the handful of entities
  // actually seen in practice so "5+ years&lt;/li&gt;&lt;li&gt;of
  // experience"-style breaks don't defeat the phrase match below.
  const plain = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ");

  const pattern = /(\d{1,2})\s*(?:\+|-|to)?\s*\d{0,2}\s*\+?\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+|prior\s+)?experience/gi;
  const matches = [...plain.matchAll(pattern)];
  if (matches.length === 0) return null;

  const years = matches
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 20);

  return years.length > 0 ? Math.min(...years) : null;
}
