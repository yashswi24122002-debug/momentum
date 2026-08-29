import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/route-guard";
import { scaleNutrition } from "@/lib/calories/nutrition";
import { computeRecipeNutrition } from "@/lib/calories/recipe-nutrition";

type ItemInput = {
  food_id?: string | null;
  recipe_id?: string | null;
  display_name: string;
  quantity: number;
  serving_label: string;
  serving_g: number;
  source: string;
  confidence: string;
  ai_confidence?: number | null;
  // Only used (and required) when neither food_id nor recipe_id is set —
  // the AI-photo/manual-custom path, where there's no reference row to
  // scale from and the caller supplies the already-determined values.
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fibre_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
};

/**
 * Resolves an item's actual stored nutrition. food_id/recipe_id items are
 * always computed server-side from the referenced row's per-100g/per-serving
 * values (never trusting client-sent numbers, which could be stale or
 * tampered) — quantity * serving_g is the total grams consumed. Items with
 * neither reference (custom/AI-photo entries) use the caller-supplied
 * values directly, since there's nothing to scale from.
 */
async function resolveItemNutrition(supabase: SupabaseClient, userId: string, item: ItemInput) {
  if (item.food_id) {
    const { data: food, error } = await supabase
      .from("foods")
      .select("kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fibre_g_per_100g, sugar_g_per_100g, sodium_mg_per_100g")
      .eq("id", item.food_id)
      .single();
    if (error || !food) throw new Error(`Food ${item.food_id} not found`);

    const totalGrams = item.quantity * item.serving_g;
    const base = scaleNutrition(food, totalGrams);
    const factor = totalGrams / 100;
    return {
      ...base,
      fibre_g: food.fibre_g_per_100g !== null ? Math.round(food.fibre_g_per_100g * factor * 10) / 10 : null,
      sugar_g: food.sugar_g_per_100g !== null ? Math.round(food.sugar_g_per_100g * factor * 10) / 10 : null,
      sodium_mg: food.sodium_mg_per_100g !== null ? Math.round(food.sodium_mg_per_100g * factor) : null,
    };
  }

  if (item.recipe_id) {
    const { data: recipe, error } = await supabase
      .from("recipes")
      .select("yield_servings, recipe_ingredients(quantity_g, foods(kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g))")
      .eq("id", item.recipe_id)
      .eq("user_id", userId)
      .single();
    if (error || !recipe) throw new Error(`Recipe ${item.recipe_id} not found`);

    const ingredients = (recipe.recipe_ingredients ?? []).map((ri: { quantity_g: number; foods: unknown }) => ({
      quantity_g: ri.quantity_g,
      food: ri.foods,
    }));
    const { perServing } = computeRecipeNutrition(ingredients as never, recipe.yield_servings);
    const servingsEaten = item.quantity;
    return {
      kcal: Math.round(perServing.kcal * servingsEaten),
      protein_g: Math.round(perServing.protein_g * servingsEaten * 10) / 10,
      carbs_g: Math.round(perServing.carbs_g * servingsEaten * 10) / 10,
      fat_g: Math.round(perServing.fat_g * servingsEaten * 10) / 10,
      fibre_g: null,
      sugar_g: null,
      sodium_mg: null,
    };
  }

  if (
    typeof item.kcal !== "number" ||
    typeof item.protein_g !== "number" ||
    typeof item.carbs_g !== "number" ||
    typeof item.fat_g !== "number"
  ) {
    throw new Error(`Item "${item.display_name}" needs food_id, recipe_id, or explicit kcal/protein_g/carbs_g/fat_g`);
  }
  return {
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fibre_g: item.fibre_g ?? null,
    sugar_g: item.sugar_g ?? null,
    sodium_mg: item.sodium_mg ?? null,
  };
}

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase.from("food_logs").select("*, food_log_items(*)").eq("user_id", user.id).order("logged_at", { ascending: true });
  if (date) query = query.eq("logged_on", date);
  if (from) query = query.gte("logged_on", from);
  if (to) query = query.lte("logged_on", to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}

// Creates a meal (food_log) with its reviewed item snapshots — PRD §7 "saving
// updates the page optimistically," §14 "nothing persists until the user
// presses Save." One POST = one confirmed meal, however many items it has.
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { logged_on, meal_type, meal_label, source, photo_url, barcode, notes, items } = body as {
    logged_on?: string;
    meal_type?: string;
    meal_label?: string | null;
    source?: string;
    photo_url?: string | null;
    barcode?: string | null;
    notes?: string | null;
    items?: ItemInput[];
  };

  if (!logged_on || !meal_type || !source) {
    return NextResponse.json({ error: "logged_on, meal_type, and source are required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  let resolvedItems;
  try {
    resolvedItems = await Promise.all(
      items.map(async (item) => ({ item, nutrition: await resolveItemNutrition(supabase, user.id, item) }))
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't resolve item nutrition" }, { status: 400 });
  }

  const { data: log, error: logError } = await supabase
    .from("food_logs")
    .insert({ logged_on, meal_type, meal_label: meal_label ?? null, source, photo_url: photo_url ?? null, barcode: barcode ?? null, notes: notes ?? null })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("food_log_items").insert(
    resolvedItems.map(({ item, nutrition }) => ({
      food_log_id: log.id,
      food_id: item.food_id ?? null,
      recipe_id: item.recipe_id ?? null,
      display_name: item.display_name,
      quantity: item.quantity,
      serving_label: item.serving_label,
      serving_g: item.serving_g,
      ...nutrition,
      source: item.source,
      confidence: item.confidence,
      ai_confidence: item.ai_confidence ?? null,
    }))
  );

  if (itemsError) {
    await supabase.from("food_logs").delete().eq("id", log.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const { data: full } = await supabase.from("food_logs").select("*, food_log_items(*)").eq("id", log.id).single();

  return NextResponse.json({ log: full }, { status: 201 });
}
