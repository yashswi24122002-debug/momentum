import type { SignalResult } from "@/lib/integrations/types";

/** YouTube Data API v3 search — trending-ish travel Shorts by recent view count. */
export async function fetchYouTubeSignals(limit = 15): Promise<SignalResult> {
  const source = "youtube";
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { source, signals: [], error: "YOUTUBE_API_KEY is not configured" };
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: "travel shorts",
      type: "video",
      videoDuration: "short",
      order: "viewCount",
      maxResults: String(limit),
      key: apiKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { source, signals: [], error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.error) {
      return { source, signals: [], error: json.error.message ?? "Unknown YouTube API error" };
    }

    const signals: string[] = (json.items ?? [])
      .map((item: { snippet?: { title?: string } }) => item.snippet?.title)
      .filter((title: string | undefined): title is string => Boolean(title));

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
