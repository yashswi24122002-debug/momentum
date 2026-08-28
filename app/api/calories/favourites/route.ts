import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table as a dedicated endpoint, but PRD §7's
// "favourites and recents" quick-add path needs somewhere to read/toggle them.
export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("food_favourites")
    .select("*, foods(id, name, default_serving_name, default_serving_g, kcal_per_100g), recipes(id, name, yield_servings)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favourites: data });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { food_id, recipe_id } = body as { food_id?: string; recipe_id?: string };

  if (!food_id && !recipe_id) {
    return NextResponse.json({ error: "food_id or recipe_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("food_favourites")
    .insert({ food_id: food_id ?? null, recipe_id: recipe_id ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favourite: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const foodId = searchParams.get("food_id");
  const recipeId = searchParams.get("recipe_id");

  let query = supabase.from("food_favourites").delete();
  if (foodId) query = query.eq("food_id", foodId);
  else if (recipeId) query = query.eq("recipe_id", recipeId);
  else return NextResponse.json({ error: "food_id or recipe_id is required" }, { status: 400 });

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
