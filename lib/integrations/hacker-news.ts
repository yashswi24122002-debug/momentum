import type { SignalResult } from "@/lib/integrations/types";

/**
 * Hacker News via the Algolia Search API — no auth required.
 * Docs: https://hn.algolia.com/api
 */
export async function fetchHackerNewsSignals(limit = 15): Promise<SignalResult> {
  const source = "hacker-news";
  try {
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      return { source, signals: [], error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const signals: string[] = (json.hits ?? [])
      .map((hit: { title?: string }) => hit.title)
      .filter((title: string | undefined): title is string => Boolean(title));

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
