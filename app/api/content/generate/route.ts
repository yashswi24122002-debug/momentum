import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
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
  additional_signals: z
    .array(z.string())
    .max(2)
    .describe(
      "0-2 more signals (verbatim, including any embedded URL) that also relate to this idea, ideally from a DIFFERENT source than trend_signal — used to provide multiple reference links from different sources. Leave empty if nothing else fits."
    ),
  matched_trip_ids: z.array(z.string()),
  assets_gap: z.string(),
  hashtag: z
    .string()
    .describe(
      "One relevant hashtag for this idea's topic, lowercase, no spaces, no # symbol (e.g. 'vietnamtravel') — used to link to real similar posts, not literally posted as-is."
    ),
});
const ContentIdeasResponseSchema = z.array(ContentIdeaSchema).length(IDEA_COUNT);

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  youtube: "YouTube",
  "google-trends": "Google Trends",
};

const TRIP_STAGES = ["general", "planning", "traveling", "returned"] as const;
type TripStage = (typeof TRIP_STAGES)[number];
const FORMAT_PREFERENCES = ["any", "reel", "carousel"] as const;
type FormatPreference = (typeof FORMAT_PREFERENCES)[number];

type GenerateContext = {
  location: string | null;
  tripStage: TripStage;
  formatPreference: FormatPreference;
};

function parseContext(body: unknown): GenerateContext {
  const b = (body ?? {}) as Record<string, unknown>;
  const location = typeof b.location === "string" && b.location.trim() ? b.location.trim() : null;
  const tripStage = TRIP_STAGES.includes(b.trip_stage as TripStage) ? (b.trip_stage as TripStage) : "general";
  const formatPreference = FORMAT_PREFERENCES.includes(b.format_preference as FormatPreference)
    ? (b.format_preference as FormatPreference)
    : "any";
  return { location, tripStage, formatPreference };
}

function contextLine({ location, tripStage }: GenerateContext): string | null {
  if (!location) return null;
  switch (tripStage) {
    case "planning":
      return `I'm planning an upcoming trip to ${location} — favor prep content (packing, budgeting, itinerary planning, what to book ahead) over in-the-moment content.`;
    case "traveling":
      return `I'm in ${location} right now — favor content I could shoot today or this week.`;
    case "returned":
      return `I just got back from ${location} — favor reflective/recap content (what I'd do differently, highlights, lessons learned) using footage I'd already have.`;
    default:
      return `I'm currently based in/near ${location}.`;
  }
}

// Real signal URLs are embedded in the signal text itself (see
// lib/integrations/youtube.ts and the embedUrls flag on fetchRedditSignals)
// so they can be extracted here rather than trusting the model to
// construct a URL from scratch, which LLMs reliably hallucinate.
function extractUrl(text: string): { source: string; url: string } | null {
  const youtube = text.match(/https:\/\/youtu\.be\/[\w-]+/);
  if (youtube) return { source: "YouTube", url: youtube[0] };
  const reddit = text.match(/https:\/\/www\.reddit\.com\/r\/\S+/);
  if (reddit) return { source: "Reddit", url: reddit[0].replace(/[),.]+$/, "") };
  return null;
}

/**
 * Up to 3 real reference links from different sources: a link per distinct
 * signal cited (trend_signal + additional_signals), plus an Instagram
 * hashtag-explore link (always valid, always shows real relevant posts —
 * the closest honest substitute for a specific post link, which no
 * Instagram API in this stack could provide).
 */
function buildReferenceLinks(idea: z.infer<typeof ContentIdeaSchema>): { source: string; url: string }[] {
  const links: { source: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const signal of [idea.trend_signal, ...idea.additional_signals]) {
    const extracted = extractUrl(signal);
    if (extracted && !seen.has(extracted.url)) {
      links.push(extracted);
      seen.add(extracted.url);
    }
  }

  const tag = idea.hashtag.toLowerCase().replace(/[^a-z0-9]/g, "") || "travel";
  const igUrl = `https://www.instagram.com/explore/tags/${tag}/`;
  if (!seen.has(igUrl)) links.push({ source: "Instagram", url: igUrl });

  return links.slice(0, 3);
}

function buildPrompt(
  signals: string[],
  trips: { id: string; name: string; location_summary: string | null; content_worthy_count: number }[],
  recentTitles: string[],
  context: GenerateContext
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

  const contextBlock = contextLine(context);
  const formatBlock =
    context.formatPreference !== "any" ? `\n\nStrongly prefer the ${context.formatPreference} format for all ${IDEA_COUNT} ideas.` : "";

  return `You are helping ME plan my next personal travel Instagram post (Reel or carousel). This is MY personal account, not a generic travel brand — every single idea must be ME-CENTRIC: a first-person story about something I actually did, a specific trip or trek I took, or a fun moment with my friends. Never generic third-party advice, listicles, or "5 best places to X" style content — that reads like a brand account, not a person.${
    contextBlock ? `\n\n${contextBlock}` : ""
  }

Below are trending travel-content signals from Reddit, YouTube, and Google Trends (India-focused), plus a summary of my tagged photo library grouped by trip. Use my actual trips from the library as the primary source of real topics when they fit — cite the trip by name. If the library is empty or doesn't cover a good idea, invent a plausible personal narrative instead (a specific real-sounding trek/destination reachable from India, a first-time story, a moment with friends) — never fall back to generic advice content.

Treat the trend signals as a source of currently-working FORMATS and HOOKS (e.g. "day in my life", "what nobody tells you about X", "expectation vs reality", a POV style), not as literal topics — I am not restating what's trending, I'm telling my own story using a format that's currently resonating.

Good title examples: "My First Day in Vietnam", "Indrahar Trek — Solo and Completely Underprepared", "The Time My Friends and I Got Lost in Rishikesh", "What My First International Trip Taught Me", "3 Things Nobody Tells You About Trekking Alone".
Bad examples (do not produce): "5 Best Places to Trek Near Delhi", "Top Budget Destinations in India", "How to Plan Your Trip to Vietnam" — these are generic advice, not personal.${formatBlock}

For each idea, provide: title, format (reel or carousel), which trend source and specific signal inspired the format/hook (copy the signal text verbatim, including any URL present), 0-2 additional_signals from OTHER sources that also relate (verbatim, including any URL — for multiple reference links from different sources; leave empty if nothing else fits, don't force it), which trip(s) from my library it uses (matched_trip_ids — the exact trip IDs listed below, or an empty array if it's a new/invented story), assets_gap describing what's missing (or "none" if fully covered), and one relevant hashtag for the topic.

Trend signals:
${signals.map((s) => `- ${s}`).join("\n")}

My photo library (by trip):
${mediaSummary}${recentTitlesBlock}`;
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "content_generate", isAdmin, IDEA_COUNT);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const context = parseContext(await request.json().catch(() => ({})));

  const youtubeQuery = context.location ? `${context.location} travel shorts` : undefined;
  const trendsKeyword = context.location ? `${context.location} travel` : undefined;

  const [reddit, youtube, googleTrends] = await Promise.all([
    fetchRedditSignals(["travel", "solotravel", "digitalnomad", "travelphotography", "IndiaTravel"], 10, "day", true),
    youtubeQuery ? fetchYouTubeSignals(youtubeQuery) : fetchYouTubeSignals(),
    trendsKeyword ? fetchGoogleTrendsSignals(trendsKeyword) : fetchGoogleTrendsSignals(),
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

  const { data: trips } = await supabase.from("trips").select("id, name, location_summary").eq("user_id", user.id);
  const { data: contentWorthyMedia } = await supabase
    .from("media")
    .select("id, trip_id")
    .eq("user_id", user.id)
    .eq("content_worthy", true);
  const { data: recentIdeas } = await supabase
    .from("content_ideas")
    .select("title")
    .eq("user_id", user.id)
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
    ideas = await generateContent(apiKey, buildPrompt(signals, tripSummaries, recentTitles, context), ContentIdeasResponseSchema);
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
          reference_links: buildReferenceLinks(idea),
        };
      })
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content_ideas: data }, { status: 201 });
}
