import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { normalizeFoodName } from "@/lib/calories/normalize";

// Search across the Indian catalogue + personal foods by name/normalized
// name/barcode. No query param returns the full personal-food set (used by
// the "personal foods" list view) plus nothing else — search is opt-in via ?q=.
export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const personalOnly = searchParams.get("personalOnly") === "true";
  const indianOnly = searchParams.get("indianOnly") === "true";

  let query = supabase.from("foods").select("*, food_servings(*)").order("name");
  // foods.user_id is null for the shared catalogue — RLS's admin bypass
  // otherwise returns every member's personal foods to the admin's own
  // session, not just their own, so this has to be explicit rather than
  // left to RLS alone.
  query = personalOnly ? query.eq("is_personal", true).eq("user_id", user.id) : query.or(`user_id.is.null,user_id.eq.${user.id}`);
  if (indianOnly) query = query.eq("is_indian_food", true);
  if (q) {
    const normalized = normalizeFoodName(q);
    query = query.or(`normalized_name.ilike.%${normalized}%,barcode.eq.${q}`);
  }

  const { data, error } = await query.limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ foods: data });
}

// Creates a personal food (the "no result → personal-food form" path, PRD §7).
export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const {
    name,
    brand,
    category,
    kcal_per_100g,
    protein_g_per_100g,
    carbs_g_per_100g,
    fat_g_per_100g,
    fibre_g_per_100g,
    sugar_g_per_100g,
    sodium_mg_per_100g,
    default_serving_name,
    default_serving_g,
  } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof kcal_per_100g !== "number") {
    return NextResponse.json({ error: "kcal_per_100g is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("foods")
    .insert({
      // foods.user_id has no column default (unlike other per-user tables)
      // — a personal food must always be explicitly attributed, since an
      // omitted user_id here would otherwise satisfy the "global" (null)
      // case and wrongly make a personal food visible to everyone.
      user_id: user.id,
      name: name.trim(),
      normalized_name: normalizeFoodName(name),
      brand: brand ?? null,
      category: category ?? null,
      is_personal: true,
      is_indian_food: false,
      default_serving_name: default_serving_name ?? null,
      default_serving_g: default_serving_g ?? null,
      kcal_per_100g,
      protein_g_per_100g: protein_g_per_100g ?? 0,
      carbs_g_per_100g: carbs_g_per_100g ?? 0,
      fat_g_per_100g: fat_g_per_100g ?? 0,
      fibre_g_per_100g: fibre_g_per_100g ?? null,
      sugar_g_per_100g: sugar_g_per_100g ?? null,
      sodium_mg_per_100g: sodium_mg_per_100g ?? null,
      source: "personal_food",
      confidence: "verified",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ food: data }, { status: 201 });
}
