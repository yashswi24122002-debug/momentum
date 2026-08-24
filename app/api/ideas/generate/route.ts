import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { fetchHackerNewsSignals } from "@/lib/integrations/hacker-news";
import { fetchGitHubTrendingSignals } from "@/lib/integrations/github-trending";
import { fetchRedditSignals } from "@/lib/integrations/reddit";
import { logError } from "@/lib/errors/log-error";
import { todayLocalISODate } from "@/lib/date";

const IdeaSchema = z.object({
  title: z.string(),
  one_liner: z.string(),
  category: z.string(),
  effort_estimate: z.enum(["S", "M", "L"]),
  source_signals: z.array(z.string()),
});
const IdeasResponseSchema = z.array(IdeaSchema).length(3);

function buildPrompt(signals: string[]): string {
  return `You are helping a solo software builder find their next project. Below are ${signals.length} raw signals pulled from Hacker News, GitHub Trending, and Reddit (r/SideProject, r/startups) today.

Generate exactly 3 distinct, feasible, well-scoped project or startup ideas for a solo/independent builder, spanning different categories where possible (e.g. B2B SaaS, tool/automation, niche vertical app). Each idea needs: a title, a one-sentence summary, a category, an effort estimate (S/M/L for how much work it'd take), and the exact signal strings (verbatim, copied from the list below) that inspired it.

Signals:
${signals.map((s) => `- ${s}`).join("\n")}`;
}

export async function POST() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const [hn, gh, reddit] = await Promise.all([
    fetchHackerNewsSignals(),
    fetchGitHubTrendingSignals(),
    fetchRedditSignals(["SideProject", "startups"]),
  ]);

  for (const result of [hn, gh, reddit]) {
    if (result.error) {
      await logError(supabase, `integrations/${result.source}`, result.error);
    }
  }

  const signals = [...hn.signals, ...gh.signals, ...reddit.signals];

  if (signals.length === 0) {
    await logError(supabase, "ideas/generate", "All signal sources failed or returned nothing");
    return NextResponse.json(
      { error: "Couldn't fetch any trend signals right now — try again shortly." },
      { status: 502 }
    );
  }

  let ideas: z.infer<typeof IdeasResponseSchema>;
  try {
    ideas = await generateContent(buildPrompt(signals), IdeasResponseSchema);
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
      }))
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ideas: data }, { status: 201 });
}
