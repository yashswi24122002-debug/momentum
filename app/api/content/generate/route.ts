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

function buildPrompt(signals: string[], trips: { id: string; name: string; location_summary: string | null; content_worthy_count: number }[]): string {
  const mediaSummary =
    trips.length === 0
      ? "No trips or tagged photos in the library yet."
      : trips
          .map((t) => `- ${t.id} — "${t.name}" (${t.location_summary ?? "no location noted"}): ${t.content_worthy_count} content-worthy photo(s)`)
          .join("\n");

  return `You are helping a solo travel content creator plan their next Instagram post (Reel or carousel). Below are trending travel-content signals from Reddit, YouTube, and Google Trends, plus a summary of their tagged photo library grouped by trip.

Generate exactly ${IDEA_COUNT} distinct content ideas. For each: a title, format (reel or carousel), which trend source and specific signal inspired it, which trip(s) from the library it could use (matched_trip_ids — the exact trip IDs listed below, or an empty array if none fit), and assets_gap describing what's missing if the matched trips don't have enough content-worthy photos for this idea (or "none" if fully covered).

Trend signals:
${signals.map((s) => `- ${s}`).join("\n")}

Photo library (by trip):
${mediaSummary}`;
}

export async function POST() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const [reddit, youtube, googleTrends] = await Promise.all([
    fetchRedditSignals(["travel", "solotravel", "digitalnomad", "travelphotography"]),
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

  const countByTrip = new Map<string, number>();
  for (const m of contentWorthyMedia ?? []) {
    if (m.trip_id) countByTrip.set(m.trip_id, (countByTrip.get(m.trip_id) ?? 0) + 1);
  }
  const tripSummaries = (trips ?? []).map((t) => ({
    ...t,
    content_worthy_count: countByTrip.get(t.id) ?? 0,
  }));

  let ideas: z.infer<typeof ContentIdeasResponseSchema>;
  try {
    ideas = await generateContent(buildPrompt(signals, tripSummaries), ContentIdeasResponseSchema);
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
