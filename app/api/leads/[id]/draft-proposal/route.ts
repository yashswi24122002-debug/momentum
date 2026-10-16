import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError, ServerOverloadedError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

// There's no technical data to cite for a lead with no website at all —
// this is the forward-looking equivalent of the audit's AI summary: a
// short business case plus suggested pages, tailored to their category,
// not a generic list.
const ProposalSchema = z.object({
  why: z
    .string()
    .describe(
      "2-3 sentences, written in first person as if you personally are making this case to the business owner (\"I think\", \"I'd suggest\" — not \"this analysis recommends\" or \"it is recommended\") — grounded in their category and Google rating if given, not generic website advice. No fabricated statistics."
    ),
  suggested_pages: z
    .array(z.string())
    .min(4)
    .max(6)
    .describe("4-6 short page/section names (2-4 words each) that make sense for a website for this specific business category, e.g. for a restaurant: 'Menu', 'Reservations', 'Gallery', 'Reviews'."),
});

function buildPrompt(name: string, category: string | null, area: string | null, rating: number | null): string {
  return `Make the business case for a website for ${name}, a ${category ?? "local business"} in ${area ?? "their area"}.
${rating !== null ? `Their Google rating is ${rating} stars — a real number, safe to reference.` : "No Google rating yet."}

Suggest 4-6 pages/sections that make sense for a website for this specific kind of business — not a generic list, tailored to what a ${category ?? "local business"} actually needs.`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  try {
    await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "leads_draft_proposal", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const { id } = await params;

  const { data: lead, error: leadError } = await supabase
    .from("business_leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.existing_website) {
    return NextResponse.json({ error: "This lead already has a website — use Website Report instead" }, { status: 400 });
  }

  let proposal: z.infer<typeof ProposalSchema>;
  try {
    proposal = await generateContentAsUser(
      user.id,
      isAdmin,
      buildPrompt(lead.name, lead.category, lead.area, lead.google_rating),
      ProposalSchema
    );
  } catch (error) {
    await logError(supabase, "leads/draft-proposal", error instanceof Error ? error.message : String(error), { leadId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable proposal — try again."
        : error instanceof ServerOverloadedError
          ? "Gemini is temporarily overloaded with requests — try again in a moment."
          : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("lead_website_proposals")
    .insert({
      lead_id: id,
      why: proposal.why,
      suggested_pages: proposal.suggested_pages,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: inserted });
}
