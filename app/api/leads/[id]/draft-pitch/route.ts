import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError, ServerOverloadedError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import type { BusinessLead, WebsiteAudit, LeadWebsiteProposal } from "@/lib/types/leads";
import type { ResumeContent } from "@/lib/types/resume";

// Subject, greeting, personal intro, closing, and sign-off are all composed
// in code — never left to the model — so the format is guaranteed every
// time and the subject line in particular can never pick up spam-trigger
// phrasing. The AI writes a one-sentence context opener plus the specific
// findings as bullet points (not a labeled "Label: text" list, which reads
// as AI-written and is itself a spam-filter heuristic for mass-marketing
// templates — plain bullets with the key number bolded instead).
const PitchSchema = z.object({
  opening: z
    .string()
    .describe(
      "ONE formal sentence of context — their rating/reputation if it's good, transitioning into the specific findings that follow. No greeting, no bullet points, no sign-off."
    ),
  findings: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "2-4 concise, complete bullet points (one sentence each), grounded in the real data given below — don't omit a relevant detail just to keep it short, and never invent a specific number/statistic that isn't given to you. Bold a real number with markdown **double asterisks** wherever one is actually given below (a measured website metric, or their Google rating) — if no real number applies to a bullet, write it in plain prose instead rather than fabricating one. Formal register, no contractions, no spam-trigger language (exclamation points, ALL-CAPS, hard sales pitch)."
    ),
});

function buildPrompt(lead: BusinessLead, audit: WebsiteAudit | null, proposal: LeadWebsiteProposal | null): string {
  const ratingNote =
    lead.google_rating !== null ? `Google rating: ${lead.google_rating} stars — a real number, safe to bold if used.` : "Google rating: none yet.";

  // When a completed audit exists, ground the bullets in its actual
  // findings instead of guessing generically. With no website at all,
  // there's no technical data to cite — the bullets should instead make
  // the business case for having one (findability, credibility, losing
  // business to competitors who do), using only the real data given here
  // (the rating, category, area), never a fabricated statistic.
  const situationNote = lead.existing_website
    ? audit?.status === "completed"
      ? `They do have a website (${lead.existing_website}). A technical audit found these real, specific problems — use these, not generic guesses:
Scores (0-100): ${JSON.stringify(audit.scores)}
Top issues: ${JSON.stringify((audit.issues ?? []).slice(0, 6))}
${audit.ai_summary ? `Summary: ${audit.ai_summary}` : ""}`
      : `They do have a website (${lead.existing_website}), but no technical audit data is available yet — focus the bullets on the business case for a stronger web presence in general terms (credibility, findability, showcasing their work), not fabricated technical specifics.`
    : `They have no website at all. There is no technical data to cite — focus the bullets on the real business cost of this (prospective customers searching for their category/area can't find them online, no way to showcase services or be contacted directly, a competitor with a website likely wins that search instead). The only real number available is their Google rating, if present — use it to make the case that a good reputation deserves an equally strong online presence, rather than citing any invented statistic.${
        proposal
          ? `\n\nA proposal has already been drafted for them — use this, not generic guesses:
Why: ${proposal.why}
Suggested pages: ${JSON.stringify(proposal.suggested_pages)}`
          : ""
      }`;

  return `Write the opening sentence and findings bullets of a formal cold-outreach email to a local business offering website/software development and automation services.

Business: ${lead.name}
Category: ${lead.category ?? "unknown"}
Area: ${lead.area ?? "unknown"}
${ratingNote}
${situationNote}

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

  const { data: proposal } = lead.existing_website
    ? { data: null }
    : await supabase
        .from("lead_website_proposals")
        .select("*")
        .eq("lead_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<LeadWebsiteProposal>();

  let pitch: z.infer<typeof PitchSchema>;
  try {
    pitch = await generateContentAsUser(user.id, isAdmin, buildPrompt(lead as BusinessLead, audit, proposal), PitchSchema);
  } catch (error) {
    await logError(supabase, "leads/draft-pitch", error instanceof Error ? error.message : String(error), { leadId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable pitch — try again."
        : error instanceof ServerOverloadedError
          ? "Gemini is temporarily overloaded with requests — try again in a moment."
          : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const senderName = profile?.name ?? "the sender";
  const subject = lead.existing_website ? `Website Performance Review — ${lead.name}` : `Regarding ${lead.name}'s Online Presence`;
  const greeting = `Hi ${lead.name} team,`;
  const intro = lead.existing_website
    ? `My name is ${senderName}, and I am a Software Engineer II with experience building and optimizing websites, software products, and AI-driven workflows. I am reaching out as I came across ${lead.name}'s website and reviewed it in some detail.`
    : `My name is ${senderName}, and I am a Software Engineer II with experience building and optimizing websites, software products, and AI-driven workflows. I am reaching out as I came across ${lead.name} online and noticed you do not currently have a website.`;
  const findingsLines = pitch.findings.map((f) => `- ${f}`).join("\n");
  const automationPitch =
    "I also help businesses automate various day-to-day operations through custom software and AI-driven workflows, which can meaningfully reduce the time and cost involved in running them.";
  const closing =
    audit?.status === "completed"
      ? `I have attached a short report detailing these findings for your review. Beyond addressing these specific issues, ${automationPitch}`
      : proposal
        ? `I have attached a short proposal outlining what a website for your business could include. Beyond this, ${automationPitch}`
        : `Beyond building a strong website, ${automationPitch}`;
  const followUp = "I would be glad to discuss this further in detail and share how I can help you address these items.";
  const signoffLines = [profile?.name ? `**${profile.name}**` : null, profile?.mobile].filter(Boolean).join("\n");
  const fullBody = `${greeting}\n\n${intro}\n\n${pitch.opening.trim()}\n\n${findingsLines}\n\n${closing}\n\n${followUp}\n\nBest regards,\n${signoffLines}`;

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
