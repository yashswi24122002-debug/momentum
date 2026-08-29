import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { computeRecipeNutrition } from "@/lib/calories/recipe-nutrition";

export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*, foods(id, name, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g))")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recipes = (data ?? []).map((recipe) => {
    const ingredients = (recipe.recipe_ingredients ?? []).map((ri: { quantity_g: number; foods: unknown }) => ({
      quantity_g: ri.quantity_g,
      food: ri.foods,
    }));
    const nutrition = computeRecipeNutrition(ingredients, recipe.yield_servings);
    return { ...recipe, ...nutrition };
  });

  return NextResponse.json({ recipes });
}

// name, notes, yield_servings, total_cooked_weight_g, ingredients: [{food_id, quantity_g}]
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { name, notes, yield_servings, total_cooked_weight_g, ingredients } = body as {
    name?: string;
    notes?: string | null;
    yield_servings?: number;
    total_cooked_weight_g?: number | null;
    ingredients?: { food_id: string; quantity_g: number }[];
  };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof yield_servings !== "number" || yield_servings <= 0) {
    return NextResponse.json({ error: "yield_servings must be greater than 0" }, { status: 400 });
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return NextResponse.json({ error: "At least one ingredient is required" }, { status: 400 });
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({ name: name.trim(), notes: notes ?? null, yield_servings, total_cooked_weight_g: total_cooked_weight_g ?? null })
    .select()
    .single();

  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 500 });
  }

  const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
    ingredients.map((ing, index) => ({
      recipe_id: recipe.id,
      food_id: ing.food_id,
      quantity_g: ing.quantity_g,
      sort_order: index,
    }))
  );

  if (ingredientsError) {
    await supabase.from("recipes").delete().eq("id", recipe.id);
    return NextResponse.json({ error: ingredientsError.message }, { status: 500 });
  }

  return NextResponse.json({ recipe }, { status: 201 });
}
