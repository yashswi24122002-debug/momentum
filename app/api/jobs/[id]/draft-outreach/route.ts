import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { findContactsForDomain, guessDomain, domainFromUrl, type HunterContact } from "@/lib/integrations/hunter";
import { logError } from "@/lib/errors/log-error";

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
  job: { company: string; role_title: string; location: string | null; description_raw: string | null },
  resume: { name: string; focus_area: string | null } | null,
  contactFirstName: string | null
): string {
  return `Write a short, genuine cold-outreach email from me to ${contactFirstName ? `${contactFirstName}, a` : "a"} recruiter/hiring contact at ${job.company}, about their "${job.role_title}" role${job.location ? ` (${job.location})` : ""}.

Tone: direct, confident, not desperate, not overly formal. 3-4 short paragraphs max. Mention 1-2 concrete technical skills that plausibly match the role (infer from the role title/description below — don't invent skills that don't fit). End with a clear, low-friction ask (a quick call, or just "happy to share more"). Avoid generic mass-cold-email phrasing that trips spam filters (e.g. heavy use of "quick call", exclamation points, all-caps words, or a hard sales pitch tone) — keep it reading like a real one-to-one email.${
    resume
      ? `\n\nMy resume (focused on: ${resume.focus_area ?? resume.name}) will genuinely be attached to this email as a file — you may say something like "I've attached my resume" once, but never state or invent a filename.`
      : `\n\nNo resume will be attached to this email — do not mention an attachment, an attached resume, or an attached file anywhere in the email.`
  }

Greeting: ${contactFirstName ? `open with "Hi ${contactFirstName},"` : `I don't know the recipient's name — open with "Hi there," and never use a bracketed placeholder like [Name].`}

Role details:
${job.description_raw ? job.description_raw.slice(0, 2000) : "(no description available — write generally about the role title/company)"}`;
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
    await checkAndIncrementUsage(supabase, user.id, "jobs_draft_outreach", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const resumeId = typeof body.resume_id === "string" ? body.resume_id : null;
  // Set when the user picked a specific person from the "Check contact"
  // list — skips the auto Hunter.io lookup/pick entirely.
  const overrideEmail = typeof body.contact_email === "string" && body.contact_email.trim() ? body.contact_email.trim() : null;
  const overrideFirstName = typeof body.contact_first_name === "string" ? body.contact_first_name.trim() || null : null;
  const overrideLastName = typeof body.contact_last_name === "string" ? body.contact_last_name.trim() || null : null;

  const { data: job, error: jobError } = await supabase.from("job_postings").select("*").eq("id", id).single();
  if (jobError || !job) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  let resume: { id: string; name: string; focus_area: string | null } | null = null;
  if (resumeId) {
    const { data } = await supabase.from("resumes").select("id, name, focus_area").eq("id", resumeId).eq("user_id", user.id).single();
    resume = data ?? null;
  }

  let contact: HunterContact | null = overrideEmail
    ? { email: overrideEmail, firstName: overrideFirstName, lastName: overrideLastName, position: null, linkedin: null, phoneNumber: null, verificationStatus: null }
    : null;

  if (!contact) {
    const domain = domainFromUrl(job.url) ?? guessDomain(job.company);
    const hunterResult = await findContactsForDomain(domain);
    if (hunterResult.error) {
      await logError(supabase, "jobs/draft-outreach", `hunter: ${hunterResult.error}`, { jobId: id, domain });
    }
    contact = pickBestContact(hunterResult.contacts);
  }

  let draft: z.infer<typeof DraftSchema>;
  try {
    draft = await generateContent(apiKey, buildPrompt(job, resume, contact?.firstName ?? null), DraftSchema);
  } catch (error) {
    await logError(supabase, "jobs/draft-outreach", error instanceof Error ? error.message : String(error), { jobId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI didn't return a usable draft — try again."
        : "Something went wrong drafting the email — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: outreach, error: insertError } = await supabase
    .from("outreach")
    .insert({
      job_posting_id: id,
      contact_email: contact?.email ?? null,
      contact_name: contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null : null,
      resume_id: resume?.id ?? null,
      email_subject: draft.subject,
      email_body_draft: draft.body,
      status: "draft",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ outreach, contactFound: contact !== null }, { status: 201 });
}
