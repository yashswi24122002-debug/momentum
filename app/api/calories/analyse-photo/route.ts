import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { analysePhoto, AnalysePhotoError } from "@/lib/ai/analyse-food";
import { logError } from "@/lib/errors/log-error";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // PRD §11: "one image, maximum 10 MB"

// Never persists a log or uploads to storage — PRD §11: "nothing persists
// until ... the user presses Save," and an abandoned analysis (image
// picked but never saved) should leave no trace anywhere.
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "calories_analyse_photo", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const { imageBase64, mimeType } = body as { imageBase64?: string; mimeType?: string };

  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: "imageBase64 and mimeType are required" }, { status: 400 });
  }

  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large — please use a smaller photo." }, { status: 400 });
  }

  try {
    const result = await analysePhoto(apiKey, imageBase64, mimeType);
    return NextResponse.json({ analysis: result });
  } catch (error) {
    await logError(supabase, "calories/analyse-photo", error instanceof Error ? error.message : String(error));
    const message =
      error instanceof AnalysePhotoError
        ? "The AI couldn't produce a usable analysis of that photo — try a clearer photo or log manually."
        : "Something went wrong analysing that photo — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
