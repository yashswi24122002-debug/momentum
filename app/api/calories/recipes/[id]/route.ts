import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { computeRecipeNutrition } from "@/lib/calories/recipe-nutrition";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*, foods(id, name, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g))")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = (data.recipe_ingredients ?? []).map((ri: { quantity_g: number; foods: unknown }) => ({
    quantity_g: ri.quantity_g,
    food: ri.foods,
  }));
  const nutrition = computeRecipeNutrition(ingredients, data.yield_servings);

  return NextResponse.json({ recipe: { ...data, ...nutrition } });
}

// Replaces the ingredient list wholesale when provided — simpler and safer
// than diffing individual rows for a personal-scale recipe editor.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const { name, notes, yield_servings, total_cooked_weight_g, ingredients } = body as {
    name?: string;
    notes?: string | null;
    yield_servings?: number;
    total_cooked_weight_g?: number | null;
    ingredients?: { food_id: string; quantity_g: number }[];
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") updates.name = name.trim();
  if (notes !== undefined) updates.notes = notes;
  if (typeof yield_servings === "number") updates.yield_servings = yield_servings;
  if (total_cooked_weight_g !== undefined) updates.total_cooked_weight_g = total_cooked_weight_g;

  const { data: recipe, error } = await supabase.from("recipes").update(updates).eq("id", id).eq("user_id", user.id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(ingredients)) {
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
    const { error: insertError } = await supabase.from("recipe_ingredients").insert(
      ingredients.map((ing, index) => ({ recipe_id: id, food_id: ing.food_id, quantity_g: ing.quantity_g, sort_order: index }))
    );
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ recipe });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("recipes").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
