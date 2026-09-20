import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import type { BusinessLead } from "@/lib/types/leads";
import type { ResumeContent } from "@/lib/types/resume";

// Greeting, closing, and sign-off are composed in code — never left to the
// model — so every pitch reads like a formal cold-outreach email (proper
// greeting, structured value-prop bullets, formal closing, real signature)
// instead of a single unstructured paragraph with no framing.
const PitchSchema = z.object({
  subject: z.string().describe("A short, specific email subject line referencing their actual business — not generic."),
  opening: z
    .string()
    .describe(
      "1-2 sentences, formal, plain prose (not a list). Introduce why you're reaching out, referencing their actual business — category, rating (if good), and specifically whether they have no website or a weak one, since that's the core angle. No greeting, no sign-off."
    ),
  bullets: z
    .array(
      z.object({
        label: z.string().describe("A short 1-3 word Title Case label for this bullet, e.g. 'Opportunity', 'What I'd Build', 'Why Now'."),
        text: z.string().describe("One sentence following the label — a concrete value-prop point specific to this business's situation."),
      })
    )
    .min(2)
    .max(3)
    .describe("2-3 labeled bullets making the case for why this business should get a website/software built — specific to their category and situation, not generic."),
});

function buildPrompt(lead: BusinessLead): string {
  const websiteNote = lead.existing_website
    ? `They do have a website already (${lead.existing_website}) — the pitch should focus on it looking outdated/weak or an opportunity to modernize, not "you have no website."`
    : "They have no website at all — this is the core pitch angle: a real, well-reviewed local business with no online presence to bring customers in.";

  return `Write the opening and value-prop bullets for a formal cold-pitch email to a local business offering website/software development services.

Business: ${lead.name}
Category: ${lead.category ?? "unknown"}
Google rating: ${lead.google_rating ?? "no rating yet"}
${websiteNote}

Tone: formal, genuine, specific to this business, not a mass-template feel. Avoid generic phrases like "I hope this email finds you well" or spam-trigger language (exclamation points, all-caps, hard sales pitch).`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  try {
    await resolveGeminiApiKey(user.id, isAdmin); // fails fast if no key is configured, before any other work
    await checkAndIncrementUsage(supabase, user.id, "leads_draft_pitch", isAdmin);
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
  // The PRD is explicit: no public email means no "Draft Pitch" until one
  // is manually added — Places API never returns emails at all.
  if (!lead.email) {
    return NextResponse.json({ error: "Add an email for this lead first" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("resume_profile")
    .select("name, mobile")
    .eq("user_id", user.id)
    .maybeSingle<Pick<ResumeContent, "name" | "mobile">>();

  let pitch: z.infer<typeof PitchSchema>;
  try {
    pitch = await generateContentAsUser(user.id, isAdmin, buildPrompt(lead as BusinessLead), PitchSchema);
  } catch (error) {
    await logError(supabase, "leads/draft-pitch", error instanceof Error ? error.message : String(error), { leadId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable pitch — try again."
        : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const greeting = `Hi ${lead.name} team,`;
  const bulletLines = pitch.bullets.map((b) => `- ${b.label}: ${b.text}`).join("\n");
  const closing =
    "If this is something you'd be interested in exploring, I'd be happy to share more details or a few examples of previous work at your convenience.";
  const signoffLines = [profile?.name, profile?.mobile].filter(Boolean).join("\n");
  const fullBody = `${greeting}\n\n${pitch.opening.trim()}\n\n${bulletLines}\n\n${closing}\n\nBest regards,\n${signoffLines}`;

  const { data: outreach, error: insertError } = await supabase
    .from("lead_outreach")
    .insert({
      lead_id: id,
      pitch_subject: pitch.subject,
      pitch_body_draft: fullBody,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ outreach }, { status: 201 });
}
