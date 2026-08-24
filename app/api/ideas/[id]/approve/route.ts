import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

const ReportSchema = z.object({
  scope: z.string(),
  target_audience: z.string(),
  plan: z.string(),
  reliability_doability: z.string(),
  next_action: z.string(),
  competitive_landscape: z.string(),
  cost_estimate: z.string(),
  effort_impact_score: z.number().int().min(1).max(10),
});

function buildPrompt(idea: { title: string; one_liner: string; category: string; effort_estimate: string; source_signals: string[] | null }): string {
  return `A solo builder just approved this project idea and wants a deep-dive report before starting:

Title: ${idea.title}
One-liner: ${idea.one_liner}
Category: ${idea.category}
Effort estimate: ${idea.effort_estimate}
Signals that inspired it: ${(idea.source_signals ?? []).join("; ") || "none recorded"}

Write a structured deep-dive report with:
- scope: what's in and out of scope for a v1
- target_audience: who this is for, specifically
- plan: a week-by-week plan for the first month
- reliability_doability: an honest assessment of how doable this is solo, and the main risks
- next_action: one concrete action the builder could complete in the next 24-48 hours
- competitive_landscape: who else is doing this or something similar, and the differentiation
- cost_estimate: rough cost to build and run a v1
- effort_impact_score: a 1-10 score of expected impact relative to effort required`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: idea, error: fetchError } = await supabase
    .from("ideas")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  let report: z.infer<typeof ReportSchema>;
  try {
    report = await generateContent(buildPrompt(idea), ReportSchema);
  } catch (error) {
    await logError(supabase, "ideas/approve", error instanceof Error ? error.message : String(error), { ideaId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable report — try approving again."
        : "Something went wrong generating the report — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: reportRow, error: insertError } = await supabase
    .from("idea_reports")
    .insert({ idea_id: id, ...report })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase.from("ideas").update({ status: "approved" }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ report: reportRow }, { status: 201 });
}
