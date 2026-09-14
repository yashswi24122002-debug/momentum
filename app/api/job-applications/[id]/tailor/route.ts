import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import type { ResumeContent } from "@/lib/types/resume";

const ResumeContentSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  github: z.string().nullable(),
  mobile: z.string().nullable(),
  linkedin: z.string().nullable(),
  location: z.string().nullable(),
  education: z.array(z.object({ institution: z.string(), detail: z.string(), dates: z.string() })),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({ company: z.string(), location: z.string(), role: z.string(), dates: z.string(), bullets: z.array(z.string()) })
  ),
  projects: z.array(z.object({ name: z.string(), description: z.string(), dates: z.string() })),
  honors: z.array(z.string()),
});

const TailorResponseSchema = z.object({
  tailored_resume: ResumeContentSchema,
  cover_letter: z
    .string()
    .describe(
      "A complete, ready-to-send cover letter body (no salutation-only stub) — 3-4 paragraphs, plain text, blank line between paragraphs. First-person, genuine tone, not generic filler."
    ),
});

function buildPrompt(resume: ResumeContent, company: string, roleTitle: string, jdText: string): string {
  return `You are tailoring an existing resume to a specific job, and drafting a cover letter for the same role. This is NOT a rewrite — the person's actual experience, employers, and projects must stay exactly as they are.

Company: ${company}
Role: ${roleTitle}
Job description:
"""
${jdText.slice(0, 6000)}
"""

Current resume (JSON):
${JSON.stringify(resume)}

Hard rules for tailored_resume:
- Keep the EXACT same education entries, experience entries (same companies/roles/dates), and projects, in the same order — do not add, remove, merge, or reorder any of them.
- Within each experience entry, keep the SAME NUMBER of bullets as the original — you may reword a bullet to naturally surface a relevant keyword/technology from the job description, but never invent an achievement, technology, or responsibility that isn't already implied by the original bullet.
- Keep each bullet roughly its original length — don't expand a one-line bullet into a paragraph, and don't cut real content out of it.
- Skills: you may reorder the categories and the items within a category to foreground what's most relevant to this job, and may drop an item that's genuinely irrelevant clutter, but never add a skill that wasn't in the original list.
- Return every field of the resume, including parts you didn't change.

For cover_letter: reference 1-2 concrete things from the resume that map to what the job description actually asks for. No placeholder brackets — use the real company/role name.`;
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
    await checkAndIncrementUsage(supabase, user.id, "jobs_tailor_application", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const { id } = await params;

  const [{ data: application, error: appError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("job_applications").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("resume_profile").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (appError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (profileError || !profile) {
    return NextResponse.json({ error: "Set up your resume profile first (Jobs → My Resume)." }, { status: 400 });
  }

  const baseResume: ResumeContent = {
    name: profile.name,
    email: profile.email,
    github: profile.github,
    mobile: profile.mobile,
    linkedin: profile.linkedin,
    location: profile.location,
    education: profile.education,
    skills: profile.skills,
    experience: profile.experience,
    projects: profile.projects,
    honors: profile.honors,
  };

  let result: z.infer<typeof TailorResponseSchema>;
  try {
    result = await generateContentAsUser(
      user.id,
      isAdmin,
      buildPrompt(baseResume, application.company, application.role_title, application.jd_text),
      TailorResponseSchema
    );
  } catch (error) {
    await logError(supabase, "job-applications/tailor", error instanceof Error ? error.message : String(error), { applicationId: id });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce a usable tailored resume — try again."
        : "Something went wrong tailoring your resume — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("job_applications")
    .update({
      tailored_resume: result.tailored_resume,
      cover_letter_text: result.cover_letter,
      status: "tailored",
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
