import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

const SUGGESTION_COUNT = 5;

const UniversitySuggestionSchema = z.object({
  name: z.string(),
  program_name: z.string(),
  city: z.string(),
  reasoning: z.string(),
  estimated_requirements: z
    .string()
    .describe("Flagged as unverified — GPA/language/other estimated requirements, to be confirmed against the official site."),
});
const DiscoveryResponseSchema = z.array(UniversitySuggestionSchema).length(SUGGESTION_COUNT);

function buildPrompt(profile: Record<string, string>): string {
  return `Suggest ${SUGGESTION_COUNT} German universities with MS Cybersecurity (or closely related — information security, IT security) programs for this applicant, targeting Winter intake:

GPA: ${profile.gpa || "not specified"}
Work experience: ${profile.work_experience || "not specified"}
Budget: ${profile.budget || "not specified"}
Specialization interest: ${profile.specialization || "not specified"}
City preference: ${profile.city_preference || "not specified"}

For each university, provide: name, program_name (the exact MS program name), city, reasoning (why it fits this applicant specifically), and estimated_requirements (a best estimate of GPA/language/other requirements — clearly note this is an estimate to be verified against the official program page, not a guarantee).`;
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const profile = {
    gpa: typeof body.gpa === "string" ? body.gpa : "",
    work_experience: typeof body.work_experience === "string" ? body.work_experience : "",
    budget: typeof body.budget === "string" ? body.budget : "",
    specialization: typeof body.specialization === "string" ? body.specialization : "",
    city_preference: typeof body.city_preference === "string" ? body.city_preference : "",
  };

  let suggestions: z.infer<typeof DiscoveryResponseSchema>;
  try {
    suggestions = await generateContent(buildPrompt(profile), DiscoveryResponseSchema);
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
      suggestions.map((s) => ({
        name: s.name,
        program_name: s.program_name,
        city: s.city,
        fit_notes: s.reasoning,
        requirements: { estimated_requirements: s.estimated_requirements },
        source: "ai_suggested",
        verified: false,
        status: "researching",
      }))
    )
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ universities: data }, { status: 201 });
}
