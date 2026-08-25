import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

const ReportSchema = z.object({
  concept_format: z.string(),
  why_trending: z.string(),
  assets_available: z.string(),
  assets_needed: z.string(),
  caption_draft: z.string(),
  hashtags: z.array(z.string()),
  best_posting_window: z.string(),
  next_action: z.string(),
});

function buildPrompt(
  idea: { title: string; format: string; trend_source: string | null; trend_signal: string | null },
  matchedMedia: { location_name: string | null; taken_at: string | null }[]
): string {
  const assetsSummary =
    matchedMedia.length === 0
      ? "No matched photos in the library — this will need new content shot specifically for this idea."
      : `${matchedMedia.length} matched photo(s): ${matchedMedia
          .map((m) => m.location_name ?? "unknown location")
          .join(", ")}`;

  return `A solo travel content creator just approved this Instagram content idea and wants a full production-ready report:

Title: ${idea.title}
Format: ${idea.format}
Trend source: ${idea.trend_source ?? "unknown"}
Trend signal: ${idea.trend_signal ?? "unknown"}
Matched photo library assets: ${assetsSummary}

Write a structured report with:
- concept_format: the specific creative concept and how it fits the reel/carousel format
- why_trending: why this trend/signal is working right now
- assets_available: what's already covered by the matched photos
- assets_needed: what still needs to be shot or gathered
- caption_draft: a ready-to-post caption
- hashtags: 8-12 relevant hashtags (without the # symbol)
- best_posting_window: the best day/time to post this for reach
- next_action: one concrete next step to start executing this`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: idea, error: fetchError } = await supabase
    .from("content_ideas")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const { data: matchedMedia } = await supabase
    .from("media")
    .select("location_name, taken_at")
    .in("id", idea.matched_media_ids ?? []);

  let report: z.infer<typeof ReportSchema>;
  try {
    report = await generateContent(buildPrompt(idea, matchedMedia ?? []), ReportSchema);
  } catch (error) {
    await logError(supabase, "content/approve", error instanceof Error ? error.message : String(error), { ideaId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable report — try approving again."
        : "Something went wrong generating the report — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: reportRow, error: insertError } = await supabase
    .from("content_reports")
    .insert({ content_idea_id: id, ...report })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase.from("content_ideas").update({ status: "approved" }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ report: reportRow }, { status: 201 });
}
