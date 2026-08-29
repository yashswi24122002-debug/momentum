import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";
import { matchCuratedUniversity } from "@/lib/masters-abroad/curated-universities";

const SUGGESTION_COUNT = 5;

const UniversitySuggestionSchema = z.object({
  name: z.string(),
  program_name: z.string(),
  city: z.string(),
  reasoning: z.string(),
  estimated_requirements: z
    .string()
    .describe("Flagged as unverified — GPA/language/other estimated requirements, to be confirmed against the official site."),
  tuition_estimate: z.string().describe("Rough estimate of tuition/semester fees for this program — note it's an estimate."),
  fit_scores: z
    .object({
      gpa: z.number().int().min(0).max(100).describe("How well the applicant's GPA fits this program's typical bar."),
      budget: z.number().int().min(0).max(100).describe("How well this program's costs fit the applicant's stated budget."),
      specialization: z.number().int().min(0).max(100).describe("How well this program matches the applicant's specialization interest."),
    })
    .describe("Numeric fit scores 0-100 — be genuinely discriminating, not uniformly high."),
});
const DiscoveryResponseSchema = z.array(UniversitySuggestionSchema).length(SUGGESTION_COUNT);

function buildPrompt(profile: Record<string, string>, excludeNames: string[]): string {
  const excludeBlock =
    excludeNames.length === 0
      ? ""
      : `\n\nAlready suggested or already in this applicant's list — do NOT suggest these again:\n${excludeNames.map((n) => `- ${n}`).join("\n")}`;

  return `Suggest ${SUGGESTION_COUNT} German universities with MS Cybersecurity (or closely related — information security, IT security) programs for this applicant, targeting Winter intake:

GPA: ${profile.gpa || "not specified"}
Work experience: ${profile.work_experience || "not specified"}
Budget: ${profile.budget || "not specified"}
Specialization interest: ${profile.specialization || "not specified"}
City preference: ${profile.city_preference || "not specified"}

For each university, provide: name, program_name (the exact MS program name), city, reasoning (why it fits this applicant specifically), estimated_requirements (a best estimate of GPA/language/other requirements — clearly note this is an estimate to be verified), tuition_estimate (rough per-semester cost estimate), and fit_scores (gpa/budget/specialization, each 0-100 — score honestly and with real spread, not every suggestion should score similarly).${excludeBlock}`;
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "masters_discover", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const profile = {
    gpa: typeof body.gpa === "string" ? body.gpa : "",
    work_experience: typeof body.work_experience === "string" ? body.work_experience : "",
    budget: typeof body.budget === "string" ? body.budget : "",
    specialization: typeof body.specialization === "string" ? body.specialization : "",
    city_preference: typeof body.city_preference === "string" ? body.city_preference : "",
  };

  const { data: existing } = await supabase.from("universities").select("name");
  const excludeNames = (existing ?? []).map((u) => u.name);

  let suggestions: z.infer<typeof DiscoveryResponseSchema>;
  try {
    suggestions = await generateContent(apiKey, buildPrompt(profile, excludeNames), DiscoveryResponseSchema);
  } catch (error) {
    await logError(supabase, "universities/discover", error instanceof Error ? error.message : String(error));
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce usable suggestions — try again."
        : "Something went wrong finding universities — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("universities")
    .insert(
      suggestions.map((s) => {
        const curated = matchCuratedUniversity(s.name);
        const overall = Math.round((s.fit_scores.gpa + s.fit_scores.budget + s.fit_scores.specialization) / 3);
        return {
          name: s.name,
          program_name: s.program_name,
          city: s.city,
          fit_notes: s.reasoning,
          requirements: {
            estimated_requirements: s.estimated_requirements,
            tuition_estimate: curated?.tuitionNote ?? s.tuition_estimate,
            fit_scores: { ...s.fit_scores, overall },
          },
          official_url: curated?.officialUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`${s.name} ${s.program_name} official site`)}`,
          source: "ai_suggested",
          verified: false,
          status: "researching",
        };
      })
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ universities: data }, { status: 201 });
}
