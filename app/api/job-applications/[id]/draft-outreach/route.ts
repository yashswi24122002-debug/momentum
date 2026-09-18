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

// Fixed wording for the ask — a declarative statement, never a question
// ("Would you be open to...?" reads weaker and was explicitly rejected in
// favor of this phrasing). Kept out of the model's hands entirely, same
// reasoning as the greeting/sign-off: exact wording that matters isn't
// left to chance.
const ASK_TEXT: Record<OutreachMode, string> = {
  referral:
    "I would greatly appreciate a referral for the role, or, if appropriate, being directed to the relevant person on the team who I could connect with regarding the opportunity.",
  hiring_team:
    "I would greatly appreciate the opportunity to be considered for this role, and would be happy to share more information or discuss further at your convenience.",
};

// The AI only ever writes the role mention + skills-match bullets —
// greeting, thanks line, sign-off, and the ask are all composed below
// instead of trusted to the model, so the approved format (Hi X, / role
// mention / skills as actual bullet points / fixed non-question ask /
// thank you for your consideration / Regards, name, phone) is guaranteed
// every single time, not just usually.
const DraftSchema = z.object({
  subject: z.string().describe("A short, specific email subject line — not generic ('Application for X role' is too generic; reference the actual company/role)."),
  role_mention: z
    .string()
    .describe(
      "1-2 sentences, plain prose (not a list), on the specific role and what about it caught your attention. No greeting, no sign-off."
    ),
  skills_match: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "2-4 short bullet points (each item is ONE bullet, one sentence, not a paragraph), each connecting one concrete skill/technology/experience from the resume to something specific the job description actually asks for. Infer from the job description — don't invent skills that don't fit."
    ),
});

function buildPrompt(
  application: { company: string; role_title: string; jd_text: string },
  resume: ResumeContent | null
): string {
  const topSkills = resume?.skills.flatMap((s) => s.items).slice(0, 8).join(", ");
  return `Write two things for a short, genuine cold-outreach email about ${application.company}'s "${application.role_title}" role: (1) a brief role_mention, and (2) 2-4 skills_match bullets.

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
  const { contact_email, contact_first_name, contact_last_name, outreach_mode } = body as {
    contact_email?: string;
    contact_first_name?: string | null;
    contact_last_name?: string | null;
    outreach_mode?: OutreachMode;
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

  let draft: z.infer<typeof DraftSchema>;
  try {
    draft = await generateContentAsUser(user.id, isAdmin, buildPrompt(application, resume), DraftSchema);
  } catch (error) {
    await logError(supabase, "job-applications/draft-outreach", error instanceof Error ? error.message : String(error), { applicationId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable draft — try again."
        : "Something went wrong drafting that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // The approved format's mechanical parts — never left to the model.
  const greeting = contact_first_name ? `Hi ${contact_first_name},` : "Hi team,";
  const skillsBullets = draft.skills_match.map((s) => `- ${s}`).join("\n");
  const attachmentLine = "I've attached my resume and a tailored cover letter for a closer look at my work.";
  const closingLine = "Thank you so much for your time and consideration.";
  const signoffLines = [resume?.name, resume?.mobile].filter(Boolean).join("\n");
  const fullBody = `${greeting}\n\n${draft.role_mention.trim()}\n\n${skillsBullets}\n\n${attachmentLine} ${ASK_TEXT[mode]}\n\n${closingLine}\n\nRegards,\n${signoffLines}`;

  const { data: updated, error: updateError } = await supabase
    .from("job_applications")
    .update({
      contact_email: finalContactEmail,
      contact_name: finalContactName,
      email_subject: draft.subject,
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
