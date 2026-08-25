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
  timeframe: "day" | "week" = "day",
  // Shared with the Ideas Tool, which doesn't strip embedded URLs from its
  // citation display — only opt in where the caller handles that (Content
  // Creation's reference links).
  embedUrls = false
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
      const posts: string[] = (json.data?.children ?? [])
        .map((child: { data?: { title?: string; permalink?: string } }) => {
          const title = child.data?.title;
          if (!title) return null;
          if (embedUrls && child.data?.permalink) {
            return `${title} (https://www.reddit.com${child.data.permalink})`;
          }
          return title;
        })
        .filter((s: string | null): s is string => Boolean(s));

      signals.push(...posts);
    } catch (error) {
      errors.push(`r/${subreddit}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { source, signals, error: errors.length > 0 ? errors.join("; ") : undefined };
}
