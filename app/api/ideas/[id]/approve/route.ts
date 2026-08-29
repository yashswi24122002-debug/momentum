import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

const ReportSchema = z.object({
  scope: z
    .string()
    .min(150)
    .describe(
      "Two clearly labeled sections, 'In scope for v1:' and 'Out of scope for v1:', each listing specific, concrete features — not vague statements."
    ),
  target_audience: z
    .string()
    .min(80)
    .describe("The specific, narrow target audience — who exactly, not a broad category — and why they'd care."),
  plan: z
    .string()
    .min(300)
    .describe(
      "A week-by-week plan for the first 4 weeks. Each week starts with 'Week N:' on its own line followed by concrete, specific tasks (not vague goals)."
    ),
  reliability_doability: z
    .string()
    .min(200)
    .describe(
      "An honest assessment covering three labeled parts: 'Technical risk:', 'Market risk:', and 'Biggest failure mode:' — each with a specific risk and how to mitigate it."
    ),
  next_action: z
    .string()
    .min(60)
    .describe("One concrete, specific action completable in the next 24-48 hours — not a vague direction."),
  competitive_landscape: z
    .string()
    .min(200)
    .describe(
      "Name at least 2 real or plausible existing products/companies in this space, and the specific differentiation angle against each."
    ),
  cost_estimate: z
    .string()
    .min(100)
    .describe(
      "A breakdown into 'Infrastructure/hosting:', 'Third-party APIs/tools:', and 'Time cost:', each with a rough dollar figure or range."
    ),
  effort_impact_score: z.number().int().min(1).max(10),
});

function buildPrompt(idea: { title: string; one_liner: string; category: string; effort_estimate: string; source_signals: string[] | null; explainer: string | null }): string {
  return `A solo builder just approved this project idea and wants a thorough, specific deep-dive report before starting — not vague generalities, but the kind of detail they could actually act on this week.

Title: ${idea.title}
One-liner: ${idea.one_liner}
Category: ${idea.category}
Effort estimate: ${idea.effort_estimate}
Context: ${idea.explainer ?? "none recorded"}
Signals that inspired it: ${(idea.source_signals ?? []).join("; ") || "none recorded"}

Write a structured deep-dive report. Be concrete and specific throughout — name real tools, real competitors, real numbers where possible, and avoid generic startup-advice filler. Use line breaks within each field to keep the labeled sub-sections readable.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

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
    report = await generateContent(apiKey, buildPrompt(idea), ReportSchema);
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
