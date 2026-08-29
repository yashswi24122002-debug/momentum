import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { fetchHackerNewsSignals } from "@/lib/integrations/hacker-news";
import { fetchGitHubTrendingSignals } from "@/lib/integrations/github-trending";
import { fetchRedditSignals } from "@/lib/integrations/reddit";
import { fetchDevToSignals } from "@/lib/integrations/devto";
import { fetchLobstersSignals } from "@/lib/integrations/lobsters";
import { logError } from "@/lib/errors/log-error";
import { todayLocalISODate } from "@/lib/date";
import type { SignalResult } from "@/lib/integrations/types";

const IDEA_COUNT = 5;

const IdeaSchema = z.object({
  title: z.string(),
  one_liner: z.string(),
  category: z.string(),
  effort_estimate: z.enum(["S", "M", "L"]),
  source_signals: z.array(z.string()),
  explainer: z
    .string()
    .describe(
      "2-3 plain-language sentences explaining any jargon, technology, or trend in the idea that a non-expert wouldn't recognize (e.g. what eBPF is, why it matters here)."
    ),
});
const IdeasResponseSchema = z.array(IdeaSchema).length(IDEA_COUNT);

const SOURCE_LABELS: Record<string, string> = {
  "hacker-news": "Hacker News",
  "github-trending": "GitHub Trending",
  reddit: "Reddit",
  "dev.to": "Dev.to",
  lobsters: "Lobsters",
};

function tagSignals(result: SignalResult): string[] {
  const label = SOURCE_LABELS[result.source] ?? result.source;
  return result.signals.map((s) => `[${label}] ${s}`);
}

function buildPrompt(signals: string[]): string {
  return `You are helping a solo software builder find their next project. Below are ${signals.length} raw signals pulled today from Hacker News, GitHub Trending, Reddit, Dev.to, and Lobsters — each tagged with its source in brackets.

Generate exactly ${IDEA_COUNT} distinct, feasible, well-scoped project or startup ideas for a solo/independent builder, spanning different categories where possible (e.g. B2B SaaS, tool/automation, niche vertical app).

Prioritize non-obvious ideas: look for an underexploited niche, a specific angle within a trending topic that most people building in that space haven't already done, or a pattern that shows up across multiple unrelated signals. Avoid generic "AI wrapper" or copycat ideas that are the first obvious thing anyone would build from a signal — dig for the less-obvious opportunity underneath it.

For each idea, provide:
- title, one_liner, category, effort_estimate (S/M/L)
- source_signals: the exact tagged signal strings (verbatim, including the "[Source]" prefix, copied from the list below) that inspired it
- explainer: 2-3 plain-language sentences explaining any jargon, technology, or trend the idea assumes familiarity with — written for someone who has never heard of it

Signals:
${signals.map((s) => `- ${s}`).join("\n")}`;
}

export async function POST() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "ideas_generate", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const results = await Promise.all([
    fetchHackerNewsSignals(),
    fetchGitHubTrendingSignals(),
    fetchRedditSignals(["SideProject", "startups"]),
    fetchDevToSignals(),
    fetchLobstersSignals(),
  ]);

  for (const result of results) {
    if (result.error) {
      await logError(supabase, `integrations/${result.source}`, result.error);
    }
  }

  const signals = results.flatMap(tagSignals);

  if (signals.length === 0) {
    await logError(supabase, "ideas/generate", "All signal sources failed or returned nothing");
    return NextResponse.json(
      { error: "Couldn't fetch any trend signals right now — try again shortly." },
      { status: 502 }
    );
  }

  let ideas: z.infer<typeof IdeasResponseSchema>;
  try {
    ideas = await generateContent(apiKey, buildPrompt(signals), IdeasResponseSchema);
  } catch (error) {
    await logError(supabase, "ideas/generate", error instanceof Error ? error.message : String(error));
    const message =
      error instanceof GenerateContentError
        ? "The AI didn't return usable ideas — try generating again."
        : "Something went wrong generating ideas — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const dateGenerated = todayLocalISODate();
  const { data, error } = await supabase
    .from("ideas")
    .insert(
      ideas.map((idea) => ({
        date_generated: dateGenerated,
        title: idea.title,
        one_liner: idea.one_liner,
        category: idea.category,
        effort_estimate: idea.effort_estimate,
        source_signals: idea.source_signals,
        explainer: idea.explainer,
      }))
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ideas: data }, { status: 201 });
}
