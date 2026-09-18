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

// The AI only ever writes the persuasive middle — greeting, thanks line,
// and sign-off are composed below instead of trusted to the model, so the
// approved format (Hi X, / ... / thank you for your consideration /
// Regards, name, phone) is guaranteed every single time, not just usually.
const DraftSchema = z.object({
  subject: z.string().describe("A short, specific email subject line — not generic ('Application for X role' is too generic; reference the actual company/role)."),
  body: z
    .string()
    .describe(
      "ONLY the middle of the email: 1-2 sentences on the specific role and why it caught your attention, then 1-2 sentences connecting concrete skills/experience to what the role needs, then the ask. Do NOT include a greeting (no 'Hi'/'Dear'), do NOT include a thank-you closing line, do NOT include a sign-off (no 'Regards'/name/phone) — those are added separately. Plain text, first-person, no placeholders like [Company Name]."
    ),
});

function buildPrompt(
  application: { company: string; role_title: string; jd_text: string },
  resume: ResumeContent | null,
  mode: OutreachMode,
  contactFirstName: string | null
): string {
  const topSkills = resume?.skills.flatMap((s) => s.items).slice(0, 8).join(", ");
  const askInstruction =
    mode === "referral"
      ? `This person is a peer/employee at the company (not necessarily HR) — the ask should be casual-professional: politely ask if they'd be willing to refer you internally for this role, or point you to the right person to talk to.`
      : `This person is the recruiter/hiring contact — the ask should be direct: express clear interest in being considered for the role, and offer to share more or discuss further.`;

  return `Write the middle section of a short, genuine cold-outreach email from me${contactFirstName ? ` to ${contactFirstName}` : ""} about ${application.company}'s "${application.role_title}" role.

${askInstruction}

Tone: direct, confident, not desperate, not overly formal. Mention 1-2 concrete technical skills that plausibly match the role (infer from the job description below — don't invent skills that don't fit).${
    topSkills ? ` My actual skills include: ${topSkills}.` : ""
  } Avoid generic mass-cold-email phrasing that trips spam filters (heavy use of "quick call", exclamation points, all-caps words, a hard sales pitch tone) — keep it reading like a real one-to-one message.

My resume and a tailored cover letter will genuinely be attached to this email as files — you may say something like "I've attached my resume and a cover letter" once, but never state or invent filenames.

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
    draft = await generateContentAsUser(
      user.id,
      isAdmin,
      buildPrompt(application, resume, mode, contact_first_name ?? null),
      DraftSchema
    );
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
  const closingLine = "Thank you so much for your time and consideration.";
  const signoffLines = [resume?.name, resume?.mobile].filter(Boolean).join("\n");
  const fullBody = `${greeting}\n\n${draft.body.trim()}\n\n${closingLine}\n\nRegards,\n${signoffLines}`;

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
