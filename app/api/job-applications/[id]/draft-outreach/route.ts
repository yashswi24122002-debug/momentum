import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { findContactsForDomain, guessDomain, domainFromUrl, type HunterContact } from "@/lib/integrations/hunter";
import { logError } from "@/lib/errors/log-error";
import type { ResumeContent } from "@/lib/types/resume";

const RECRUITING_HINTS = ["recruit", "talent", "hr", "people", "hiring"];

function pickBestContact(contacts: HunterContact[]) {
  const recruiting = contacts.find((c) => RECRUITING_HINTS.some((h) => c.position?.toLowerCase().includes(h)));
  return recruiting ?? contacts[0] ?? null;
}

const DraftSchema = z.object({
  subject: z.string().describe("A short, specific email subject line — not generic ('Application for X role' is too generic; reference the actual company/role)."),
  body: z.string().describe("The full email body, plain text, first-person, ready to send after light editing. No placeholders like [Company Name] — use the real values given."),
});

function buildPrompt(
  application: { company: string; role_title: string; url: string | null; jd_text: string },
  resume: ResumeContent | null,
  contactFirstName: string | null
): string {
  const topSkills = resume?.skills.flatMap((s) => s.items).slice(0, 8).join(", ");
  return `Write a short, genuine cold-outreach email from me to ${contactFirstName ? `${contactFirstName}, a` : "a"} recruiter/hiring contact at ${application.company}, about their "${application.role_title}" role.

Tone: direct, confident, not desperate, not overly formal. 3-4 short paragraphs max. Mention 1-2 concrete technical skills that plausibly match the role (infer from the job description below — don't invent skills that don't fit).${
    topSkills ? ` My actual skills include: ${topSkills}.` : ""
  } End with a clear, low-friction ask (a quick call, or just "happy to share more"). Avoid generic mass-cold-email phrasing that trips spam filters (e.g. heavy use of "quick call", exclamation points, all-caps words, or a hard sales pitch tone) — keep it reading like a real one-to-one email.

My resume and a tailored cover letter will genuinely be attached to this email as files — you may say something like "I've attached my resume and a cover letter" once, but never state or invent filenames.

Greeting: ${contactFirstName ? `open with "Hi ${contactFirstName},"` : `I don't know the recipient's name — open with "Hi there," and never use a bracketed placeholder like [Name].`}

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
  const { contact_email, contact_first_name, contact_last_name } = body as {
    contact_email?: string;
    contact_first_name?: string | null;
    contact_last_name?: string | null;
  };

  const { data: application, error: fetchError } = await supabase
    .from("job_applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let finalContactEmail = contact_email ?? null;
  let finalContactName = [contact_first_name, contact_last_name].filter(Boolean).join(" ") || null;

  if (!finalContactEmail) {
    const domain = domainFromUrl(application.url) ?? guessDomain(application.company);
    const { contacts } = await findContactsForDomain(domain);
    const best = pickBestContact(contacts);
    if (best) {
      finalContactEmail = best.email;
      finalContactName = [best.firstName, best.lastName].filter(Boolean).join(" ") || null;
    }
  }

  const resume = (application.tailored_resume as ResumeContent | null) ?? null;

  let draft: z.infer<typeof DraftSchema>;
  try {
    draft = await generateContentAsUser(
      user.id,
      isAdmin,
      buildPrompt(application, resume, contact_first_name ?? null),
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

  const { data: updated, error: updateError } = await supabase
    .from("job_applications")
    .update({
      contact_email: finalContactEmail,
      contact_name: finalContactName,
      email_subject: draft.subject,
      email_body_draft: draft.body,
      status: finalContactEmail ? "contact_found" : application.status,
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
