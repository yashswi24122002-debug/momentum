import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContent, GenerateContentError } from "@/lib/ai/generate-content";
import { logError } from "@/lib/errors/log-error";

// Fills in the "New personal food" form so the member doesn't have to leave
// the app and go look nutrition numbers up themselves — the exact gap
// reported: "I have to go to Gemini every time to search for calorie/food
// items that are not there." One call, one schema, same generateContent()
// every other AI feature uses.
const NutritionDetailsSchema = z.object({
  is_beverage: z.boolean().describe("True if this is primarily a drink/liquid (juice, milk, soda, etc.), false for solid/semi-solid food."),
  kcal_per_100: z.number().describe("Calories per 100g (solids) or per 100ml (beverages)."),
  protein_g_per_100: z.number(),
  carbs_g_per_100: z.number(),
  fat_g_per_100: z.number(),
  fibre_g_per_100: z.number().nullable(),
  sugar_g_per_100: z.number().nullable(),
  sodium_mg_per_100: z.number().nullable(),
  default_serving_name: z
    .string()
    .describe(
      "A short '<quantity> <unit>' serving description matching this app's existing convention (e.g. '1 katori', '1 roti', '1 cup', '1 glass', '1 bottle', '1 piece') — always start with the quantity, never just the bare unit."
    ),
  default_serving_amount: z.number().describe("The gram (solids) or ml (beverages) amount that default_serving_name corresponds to."),
  note: z
    .string()
    .describe(
      "One sentence: which source these estimates lean on (Indian Food Composition Tables/IFCT for Indian dishes and common Indian ingredients, otherwise general nutrition data) and that they're estimates to verify against packaging if available."
    ),
});

function buildPrompt(name: string, brand: string | null): string {
  return `Estimate nutrition facts for this food/drink item, prioritizing Indian nutrition standards (the Indian Food Composition Tables / IFCT) when it's an Indian dish, ingredient, or common Indian packaged item — fall back to general international nutrition data otherwise.

Item: ${name}${brand ? `\nBrand: ${brand}` : ""}

Decide first whether this is a beverage/liquid or a solid/semi-solid food — beverages get their nutrition per 100ml and a serving in ml (e.g. a glass, a cup, a bottle size); solids get per 100g and a serving in g (e.g. a piece, a bowl, a slice). Give your best real-world estimate for calories, protein, carbs, fat, fibre, sugar, and sodium, and a sensible default single-serving size for how this is actually eaten/drunk.`;
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  let apiKey: string;
  try {
    apiKey = await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "calories_fetch_details", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const { name, brand } = body as { name?: string; brand?: string | null };

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const details = await generateContent(apiKey, buildPrompt(name.trim(), brand?.trim() || null), NutritionDetailsSchema);
    return NextResponse.json({ details });
  } catch (error) {
    await logError(supabase, "calories/foods/fetch-details", error instanceof Error ? error.message : String(error), { name });
    const message =
      error instanceof GenerateContentError
        ? "The AI couldn't produce usable nutrition estimates for that — try adjusting the name or enter the details manually."
        : "Something went wrong fetching those details — try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
