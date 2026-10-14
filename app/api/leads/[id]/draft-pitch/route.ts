import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import type { BusinessLead, WebsiteAudit } from "@/lib/types/leads";
import type { ResumeContent } from "@/lib/types/resume";

// Subject, greeting, personal intro, closing, and sign-off are all composed
// in code — never left to the model — so the format is guaranteed every
// time and the subject line in particular can never pick up spam-trigger
// phrasing. The AI only writes the middle paragraph: flowing prose (not a
// labeled bullet list — that format reads as AI-written and is itself a
// spam-filter heuristic for mass-marketing templates) describing the
// business's situation and the specific issues found.
const PitchSchema = z.object({
  findings_prose: z
    .string()
    .describe(
      "2-4 formal sentences of connected prose (never a bulleted or labeled list) covering the overall impression and the most important specific issues with their website — or, if they have no website, the opportunity one represents. Ground this in the real data given below when available, not generic guesses. Formal register throughout, no contractions, no spam-trigger language (exclamation points, ALL-CAPS, hard sales pitch, \"I hope this email finds you well\")."
    ),
});

function buildPrompt(lead: BusinessLead, audit: WebsiteAudit | null): string {
  const websiteNote = lead.existing_website
    ? `They do have a website already (${lead.existing_website}) — focus on it looking outdated/weak or an opportunity to modernize, not "you have no website."`
    : "They have no website at all — this is the core angle: a real, well-reviewed local business with no online presence to bring customers in.";

  // When a completed audit exists, ground the prose in its actual
  // findings instead of guessing generically.
  const auditNote =
    audit?.status === "completed"
      ? `\n\nA technical audit of their website found real, specific problems — use these instead of generic guesses:
Scores (0-100): ${JSON.stringify(audit.scores)}
Top issues: ${JSON.stringify((audit.issues ?? []).slice(0, 6))}
${audit.ai_summary ? `Summary: ${audit.ai_summary}` : ""}`
      : "";

  return `Write the findings paragraph of a formal cold-outreach email to a local business offering website/software development and automation services.

Business: ${lead.name}
Category: ${lead.category ?? "unknown"}
Google rating: ${lead.google_rating ?? "no rating yet"}
${websiteNote}${auditNote}

Tone: formal, genuine, specific to this business, not a mass-template feel.`;
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

  const { data: audit } = await supabase
    .from("website_audits")
    .select("*")
    .eq("lead_id", id)
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle<WebsiteAudit>();

  let pitch: z.infer<typeof PitchSchema>;
  try {
    pitch = await generateContentAsUser(user.id, isAdmin, buildPrompt(lead as BusinessLead, audit), PitchSchema);
  } catch (error) {
    await logError(supabase, "leads/draft-pitch", error instanceof Error ? error.message : String(error), { leadId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable pitch — try again."
        : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const senderName = profile?.name ?? "the sender";
  const subject = lead.existing_website ? `A few notes on ${lead.name}'s website` : `A few notes for ${lead.name}`;
  const greeting = `Hi ${lead.name} team,`;
  const intro = lead.existing_website
    ? `My name is ${senderName}, and I am a Software Engineer II with experience building and optimizing websites, software products, and AI-driven workflows. I am reaching out as I came across ${lead.name}'s website and reviewed it in some detail.`
    : `My name is ${senderName}, and I am a Software Engineer II with experience building and optimizing websites, software products, and AI-driven workflows. I am reaching out as I came across ${lead.name} online and noticed you do not currently have a website.`;
  const closing =
    audit?.status === "completed"
      ? "I have attached a short report detailing these findings for your review. Beyond addressing these specific issues, I also help businesses automate various day-to-day operations through custom software and AI-driven workflows, which can meaningfully reduce the time and cost involved in running them."
      : "Beyond building a strong website, I also help businesses automate various day-to-day operations through custom software and AI-driven workflows, which can meaningfully reduce the time and cost involved in running them.";
  const signoffLines = [profile?.name, profile?.mobile].filter(Boolean).join("\n");
  const fullBody = `${greeting}\n\n${intro}\n\n${pitch.findings_prose.trim()}\n\n${closing}\n\nI would be glad to share further details at your convenience.\n\nBest regards,\n${signoffLines}`;

  const { data: outreach, error: insertError } = await supabase
    .from("lead_outreach")
    .insert({
      lead_id: id,
      pitch_subject: subject,
      pitch_body_draft: fullBody,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ outreach }, { status: 201 });
}
