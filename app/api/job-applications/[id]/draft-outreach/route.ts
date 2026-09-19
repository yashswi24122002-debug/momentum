import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import type { ResumeContent } from "@/lib/types/resume";

export type OutreachMode = "referral" | "hiring_team";

// Referral and hiring_team are genuinely different emails, not one skeleton
// with a swapped sentence — each mode's mechanical wording below (opening,
// closing, sign-off) is composed in code and never left to the model, so the
// approved format is guaranteed every time. Referral mode is warm/personal
// and needs no skills pitch; hiring_team mode needs labeled bullets tying
// the resume to the JD. Kept as separate schemas/prompts per mode.

const SubjectField = z
  .string()
  .describe("A short, specific email subject line — not generic ('Application for X role' is too generic; reference the actual company/role).");

const ReferralSchema = z.object({
  subject: SubjectField,
  connection_line: z
    .string()
    .describe(
      "ONE short, natural sentence explaining why you're reaching out to this specific person, based on the connection context given. Do not restate the role or company name — that's already said elsewhere. Return an empty string if no connection context was given."
    ),
});

const HiringTeamSchema = z.object({
  subject: SubjectField,
  bullets: z
    .array(
      z.object({
        label: z.string().describe("A short 1-3 word Title Case label for this bullet, e.g. 'Alignment', 'Frontend & State', 'Backend & Delivery'."),
        text: z.string().describe("One sentence following the label."),
      })
    )
    .min(2)
    .max(4)
    .describe(
      "2-4 labeled bullets. The FIRST bullet should be labeled 'Alignment' and connect something specific about the company's actual product/work (from the job description) to my focus area. The remaining bullets should each connect one concrete skill/technology/experience from my resume to something specific the job description actually asks for — don't invent skills that don't fit."
    ),
});

function buildReferralPrompt(
  application: { company: string; role_title: string },
  connectionContext: string
): string {
  return `I'm about to send a referral-request email to someone at ${application.company} about their "${application.role_title}" role. Write a short, specific subject line, and one natural sentence (connection_line) explaining why I'm reaching out to them specifically, based on this context: "${connectionContext}".

Tone: warm, genuine, like reaching out to a real acquaintance — not salesy. Keep the sentence short (it slots into a longer email, not standalone). Don't restate the role or company name in the sentence.`;
}

function buildHiringTeamPrompt(
  application: { company: string; role_title: string; jd_text: string },
  resume: ResumeContent | null
): string {
  const topSkills = resume?.skills.flatMap((s) => s.items).slice(0, 8).join(", ");
  return `Write a subject line and 2-4 labeled bullets for a short, genuine cold-outreach email about ${application.company}'s "${application.role_title}" role.

Tone: direct, confident, not desperate, not overly formal.${
    topSkills ? ` My actual skills include: ${topSkills}.` : ""
  } Avoid generic mass-cold-email phrasing that trips spam filters (heavy use of "quick call", exclamation points, all-caps words, a hard sales pitch tone) — keep it reading like a real one-to-one message, not a form letter.

Job description:
${application.jd_text.slice(0, 2000)}`;
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
    await checkAndIncrementUsage(supabase, user.id, "jobs_draft_outreach", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { contact_email, contact_first_name, contact_last_name, outreach_mode, connection_context } = body as {
    contact_email?: string;
    contact_first_name?: string | null;
    contact_last_name?: string | null;
    outreach_mode?: OutreachMode;
    connection_context?: string | null;
  };

  // Contact-finding (Hunter.io) was removed — the user always enters the
  // contact email manually now, so there's nothing to fall back to.
  if (!contact_email?.trim()) {
    return NextResponse.json({ error: "contact_email is required" }, { status: 400 });
  }
  const mode: OutreachMode = outreach_mode === "referral" ? "referral" : "hiring_team";

  const { data: application, error: fetchError } = await supabase
    .from("job_applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const finalContactEmail = contact_email.trim();
  const finalContactName = [contact_first_name, contact_last_name].filter(Boolean).join(" ") || null;

  const resume = (application.tailored_resume as ResumeContent | null) ?? null;
  const greeting = contact_first_name ? `Hi ${contact_first_name},` : "Hi team,";

  let subject: string;
  let fullBody: string;
  try {
    if (mode === "referral") {
      const context = connection_context?.trim() ?? "";
      const draft = await generateContentAsUser(user.id, isAdmin, buildReferralPrompt(application, context), ReferralSchema);
      subject = draft.subject;
      const connectionSentence = draft.connection_line.trim() ? ` ${draft.connection_line.trim()}` : "";
      const opening = `I recently came across the ${application.role_title} opportunity at ${application.company} and wanted to reach out regarding the role.${connectionSentence}`;
      const interestAsk =
        "I'm very interested in exploring this opportunity and have attached my resume for your reference. I would really appreciate it if you could take a look at my profile and consider me for the role if you find my experience relevant.";
      const closing = "Thank you for your time and consideration. I look forward to hearing from you.";
      fullBody = `${greeting}\n\nI hope you're doing well.\n\n${opening}\n\n${interestAsk}\n\n${closing}\n\nBest regards,\n${resume?.name ?? ""}`;
    } else {
      const draft = await generateContentAsUser(user.id, isAdmin, buildHiringTeamPrompt(application, resume), HiringTeamSchema);
      subject = draft.subject;
      const opening = `I am reaching out to express my strong interest in the ${application.role_title} role at ${application.company}, having recently learned about the opportunity.`;
      const bulletLines = draft.bullets.map((b) => `- ${b.label}: ${b.text}`).join("\n");
      const closing =
        "My resume is attached for your review. I look forward to the opportunity to connect and discuss how I can add value to your team.";
      const signoffLines = [resume?.name, resume?.mobile].filter(Boolean).join("\n");
      fullBody = `${greeting}\n\n${opening}\n\n${bulletLines}\n\n${closing}\n\nBest regards,\n${signoffLines}`;
    }
  } catch (error) {
    await logError(supabase, "job-applications/draft-outreach", error instanceof Error ? error.message : String(error), { applicationId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable draft — try again."
        : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("job_applications")
    .update({
      contact_email: finalContactEmail,
      contact_name: finalContactName,
      email_subject: subject,
      email_body_draft: fullBody,
      status: "contact_found",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ application: updated });
}
