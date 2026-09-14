import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { generateContentAsUser, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

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

function buildPrompt(rawText: string): string {
  return `Parse this resume's plain text into structured fields, preserving the content exactly as written — do not summarize, shorten, embellish, or invent anything not present in the text. Every bullet, dollar figure, date, and detail must come verbatim (or near-verbatim, fixing only obvious OCR/copy-paste artifacts like stray line breaks) from the source.

Resume text:
"""
${rawText.slice(0, 8000)}
"""

Group each experience entry's description into separate bullets (split on the natural bullet/line breaks in the source). If a field genuinely isn't present in the text (e.g. no GitHub link), use null (for single fields) or an empty array (for lists) rather than guessing.`;
}

// One-time setup utility (paste resume text once, get it structured) — not
// usage-capped like the recurring AI features, same reasoning as
// check-contact not being capped: it's not a repeated-use action.
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  try {
    await resolveGeminiApiKey(user.id, isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const { text } = body as { text?: string };

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const parsed = await generateContentAsUser(user.id, isAdmin, buildPrompt(text), ResumeContentSchema);
    return NextResponse.json({ profile: parsed });
  } catch (error) {
    await logError(supabase, "resume-profile/import", error instanceof Error ? error.message : String(error));
    const message =
      error instanceof GenerateContentError
        ? "Couldn't parse that into a resume — try pasting cleaner text, or fill the fields in by hand."
        : "Something went wrong parsing that — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
