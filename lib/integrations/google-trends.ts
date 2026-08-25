import googleTrends from "google-trends-api";
import type { SignalResult } from "@/lib/integrations/types";

/**
 * Google Trends has no official API — the PRD assumed a Python (pytrends)
 * helper service would be needed, but this hits the same unofficial
 * internal Google endpoint directly from Node, verified working live. It's
 * an unmaintained community package against an undocumented endpoint, so
 * treat it as the most likely of the three sources to eventually break —
 * same isolated-failure handling as everything else in lib/integrations/.
 */
export async function fetchGoogleTrendsSignals(keyword = "travel destinations"): Promise<SignalResult> {
  const source = "google-trends";
  try {
    const raw = await googleTrends.relatedQueries({ keyword, geo: "US" });
    const json = JSON.parse(raw);
    const rankedLists = json?.default?.rankedList ?? [];

    const signals = rankedLists
      .flatMap((list: { rankedKeyword?: { query?: string }[] }) => list.rankedKeyword ?? [])
      .map((k: { query?: string }) => k.query)
      .filter((q: string | undefined): q is string => Boolean(q));

    return { source, signals: Array.from(new Set(signals)) };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
