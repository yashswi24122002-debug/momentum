import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { fetchProductByBarcode, parseServingGrams } from "@/lib/integrations/open-food-facts";
import { normalizeFoodName } from "@/lib/calories/normalize";
import { logError } from "@/lib/errors/log-error";

// PRD §7: "The server queries a cached, normalized Open Food Facts result."
// First hit for a barcode calls the real API and caches the normalized
// result as a `foods` row; every later scan of the same barcode (by
// anyone, any day) is a pure DB read — no repeat OFF calls, no rate-limit
// risk. Missing/incomplete OFF data returns found:false, never a guess.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { code } = await params;

  const { data: cached } = await supabase.from("foods").select("*, food_servings(*)").eq("barcode", code).maybeSingle();
  if (cached) {
    return NextResponse.json({ found: true, food: cached, cached: true });
  }

  const result = await fetchProductByBarcode(code);
  if (!result.found) {
    if (result.error) {
      await logError(supabase, "calories/barcode", result.error, { barcode: code });
    }
    return NextResponse.json({ found: false });
  }

  const { product } = result;
  const { data: food, error: insertError } = await supabase
    .from("foods")
    .insert({
      name: product.name,
      normalized_name: normalizeFoodName(product.name),
      brand: product.brand,
      barcode: product.barcode,
      is_personal: false,
      is_indian_food: false,
      kcal_per_100g: product.kcal_per_100g,
      protein_g_per_100g: product.protein_g_per_100g,
      carbs_g_per_100g: product.carbs_g_per_100g,
      fat_g_per_100g: product.fat_g_per_100g,
      fibre_g_per_100g: product.fibre_g_per_100g,
      sugar_g_per_100g: product.sugar_g_per_100g,
      sodium_mg_per_100g: product.sodium_mg_per_100g,
      source: "open_food_facts",
      source_reference: "Open Food Facts",
      source_payload: product.source_payload,
      confidence: "reference",
    })
    .select()
    .single();

  if (insertError) {
    // Rare race: two scans of the same new barcode at once (unique
    // constraint on barcode) — just re-read what the other request cached.
    const { data: retryFood } = await supabase.from("foods").select("*, food_servings(*)").eq("barcode", code).maybeSingle();
    if (retryFood) return NextResponse.json({ found: true, food: retryFood, cached: true });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const servingGrams = parseServingGrams(product.serving_size_raw);
  const servingsToInsert = [{ food_id: food.id, label: "100 g", grams: 100, sort_order: 1 }];
  if (servingGrams && servingGrams !== 100) {
    servingsToInsert.unshift({ food_id: food.id, label: product.serving_size_raw ?? `${servingGrams} g`, grams: servingGrams, sort_order: 0 });
  }
  await supabase.from("food_servings").insert(servingsToInsert);

  const { data: full } = await supabase.from("foods").select("*, food_servings(*)").eq("id", food.id).single();

  return NextResponse.json({ found: true, food: full, cached: false });
}
