import type { SignalResult } from "@/lib/integrations/types";

/** YouTube Data API v3 search — trending-ish travel Shorts by recent view count. */
export async function fetchYouTubeSignals(query = "india travel shorts", limit = 15): Promise<SignalResult> {
  const source = "youtube";
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { source, signals: [], error: "YOUTUBE_API_KEY is not configured" };
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      videoDuration: "short",
      order: "viewCount",
      regionCode: "IN",
      relevanceLanguage: "en",
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

    // The real video URL is embedded in the signal text itself (rather than
    // asking the AI to construct one) so a downstream prompt can have the
    // model cite it verbatim — far more reliable than generating a URL from
    // scratch, which LLMs tend to hallucinate.
    const signals: string[] = (json.items ?? [])
      .map((item: { id?: { videoId?: string }; snippet?: { title?: string } }) => {
        const title = item.snippet?.title;
        const videoId = item.id?.videoId;
        if (!title) return null;
        return videoId ? `${title} (https://youtu.be/${videoId})` : title;
      })
      .filter((s: string | null): s is string => Boolean(s));

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
