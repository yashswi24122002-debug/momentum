/** Lowercase, trimmed, punctuation-stripped — matches how `normalized_name` is stored, so search can `ilike` against it consistently. */
export function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}
