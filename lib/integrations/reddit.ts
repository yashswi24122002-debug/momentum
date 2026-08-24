import type { SignalResult } from "@/lib/integrations/types";

const USER_AGENT = "momentum-app/1.0 (personal project idea generator)";

/**
 * Reddit's public, unauthenticated JSON feeds (06-Setup-Guide.md §6) — no
 * account or key needed, just a real User-Agent header. Unauthenticated
 * rate limit is ~10 req/min, well above what an on-demand, once-daily
 * generation needs across a handful of subreddits.
 */
export async function fetchRedditSignals(
  subreddits: string[],
  perSubreddit = 10,
  timeframe: "day" | "week" = "day"
): Promise<SignalResult> {
  const source = "reddit";
  const signals: string[] = [];
  const errors: string[] = [];

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=${perSubreddit}&t=${timeframe}`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        errors.push(`r/${subreddit}: HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      const titles: string[] = (json.data?.children ?? [])
        .map((child: { data?: { title?: string } }) => child.data?.title)
        .filter((title: string | undefined): title is string => Boolean(title));

      signals.push(...titles);
    } catch (error) {
      errors.push(`r/${subreddit}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, signals, error: errors.length > 0 ? errors.join("; ") : undefined };
}
