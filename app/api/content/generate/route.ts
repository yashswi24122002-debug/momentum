import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { fetchRedditSignals } from "@/lib/integrations/reddit";
import { fetchYouTubeSignals } from "@/lib/integrations/youtube";
import { fetchGoogleTrendsSignals } from "@/lib/integrations/google-trends";
import { logError } from "@/lib/errors/log-error";
import { todayLocalISODate } from "@/lib/date";

const IDEA_COUNT = 3;
const RECENT_TITLES_LIMIT = 30;

const ContentIdeaSchema = z.object({
  title: z.string(),
  format: z.enum(["reel", "carousel"]),
  trend_source: z.string(),
  trend_signal: z.string(),
  matched_trip_ids: z.array(z.string()),
  assets_gap: z.string(),
});
const ContentIdeasResponseSchema = z.array(ContentIdeaSchema).length(IDEA_COUNT);

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  youtube: "YouTube",
  "google-trends": "Google Trends",
};

function buildPrompt(
  signals: string[],
  trips: { id: string; name: string; location_summary: string | null; content_worthy_count: number }[],
  recentTitles: string[]
): string {
  const mediaSummary =
    trips.length === 0
      ? "No trips or tagged photos in the library yet."
      : trips
          .map((t) => `- ${t.id} — "${t.name}" (${t.location_summary ?? "no location noted"}): ${t.content_worthy_count} content-worthy photo(s)`)
          .join("\n");

  const recentTitlesBlock =
    recentTitles.length === 0
      ? ""
      : `\n\nIdeas already generated recently — do NOT repeat these or produce close variants of them:\n${recentTitles.map((t) => `- ${t}`).join("\n")}`;

  return `You are helping a solo Indian travel content creator plan their next Instagram post (Reel or carousel). Below are trending travel-content signals from Reddit, YouTube, and Google Trends (India-focused), plus a summary of their tagged photo library grouped by trip.

Generate exactly ${IDEA_COUNT} distinct content ideas that are concrete and realistic — the kind of specific, practical post a real travel account would make, not abstract trend-chasing. Favor formats like:
- Destination listicles: "5 best places to trek near Delhi", "3 hidden waterfalls in Meghalaya"
- Personal trip narratives: "My first international trip to Vietnam — what I'd do differently", "48 hours solo in Jaipur"
- Practical guides: budget breakdowns, packing lists, best time to visit, how-to-get-there

Each idea should read like a real post title, not a marketing concept. Use the trend signals as inspiration for what's currently resonating (destinations, formats, themes), not as literal topics to restate.

For each idea, provide: title, format (reel or carousel), which trend source and specific signal inspired it, which trip(s) from the library it could use (matched_trip_ids — the exact trip IDs listed below, or an empty array if none fit — it's fine and expected for an idea to need a destination not yet in the library), and assets_gap describing what's missing (or "none" if fully covered).

Trend signals:
${signals.map((s) => `- ${s}`).join("\n")}

Photo library (by trip):
${mediaSummary}${recentTitlesBlock}`;
}

export async function POST() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const [reddit, youtube, googleTrends] = await Promise.all([
    fetchRedditSignals(["travel", "solotravel", "digitalnomad", "travelphotography", "IndiaTravel"]),
    fetchYouTubeSignals(),
    fetchGoogleTrendsSignals(),
  ]);

  for (const result of [reddit, youtube, googleTrends]) {
    if (result.error) {
      await logError(supabase, `integrations/${result.source}`, result.error);
    }
  }

  const signals = [reddit, youtube, googleTrends].flatMap((r) =>
    r.signals.map((s) => `[${SOURCE_LABELS[r.source] ?? r.source}] ${s}`)
  );

  if (signals.length === 0) {
    await logError(supabase, "content/generate", "All signal sources failed or returned nothing");
    return NextResponse.json(
      { error: "Couldn't fetch any trend signals right now — try again shortly." },
      { status: 502 }
    );
  }

  const { data: trips } = await supabase.from("trips").select("id, name, location_summary");
  const { data: contentWorthyMedia } = await supabase
    .from("media")
    .select("id, trip_id")
    .eq("content_worthy", true);
  const { data: recentIdeas } = await supabase
    .from("content_ideas")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(RECENT_TITLES_LIMIT);

  const countByTrip = new Map<string, number>();
  for (const m of contentWorthyMedia ?? []) {
    if (m.trip_id) countByTrip.set(m.trip_id, (countByTrip.get(m.trip_id) ?? 0) + 1);
  }
  const tripSummaries = (trips ?? []).map((t) => ({
    ...t,
    content_worthy_count: countByTrip.get(t.id) ?? 0,
  }));
  const recentTitles = (recentIdeas ?? []).map((i) => i.title);

  let ideas: z.infer<typeof ContentIdeasResponseSchema>;
  try {
    ideas = await generateContent(buildPrompt(signals, tripSummaries, recentTitles), ContentIdeasResponseSchema);
  } catch (error) {
    await logError(supabase, "content/generate", error instanceof Error ? error.message : String(error));
    const message =
      error instanceof GenerateContentError
        ? "The AI didn't return usable ideas — try generating again."
        : "Something went wrong generating ideas — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // The AI cites trip IDs (that's the granularity of the library summary it
  // was given) — resolve each idea's matched trips down to their actual
  // content-worthy media IDs for storage, since that's what matched_media_ids
  // (the DB column) actually tracks.
  const validTripIds = new Set((trips ?? []).map((t) => t.id));
  const mediaByTrip = new Map<string, string[]>();
  for (const m of contentWorthyMedia ?? []) {
    if (!m.trip_id) continue;
    const list = mediaByTrip.get(m.trip_id) ?? [];
    list.push(m.id);
    mediaByTrip.set(m.trip_id, list);
  }

  const dateGenerated = todayLocalISODate();
  const { data, error } = await supabase
    .from("content_ideas")
    .insert(
      ideas.map((idea) => {
        const matchedTripIds = idea.matched_trip_ids.filter((id) => validTripIds.has(id));
        const matchedMediaIds = matchedTripIds.flatMap((tripId) => mediaByTrip.get(tripId) ?? []);
        return {
          date_generated: dateGenerated,
          title: idea.title,
          format: idea.format,
          trend_source: idea.trend_source,
          trend_signal: idea.trend_signal,
          matched_media_ids: matchedMediaIds,
        };
      })
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content_ideas: data }, { status: 201 });
}
