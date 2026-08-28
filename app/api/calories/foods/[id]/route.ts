import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { normalizeFoodName } from "@/lib/calories/normalize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const field of [
    "name",
    "brand",
    "category",
    "kcal_per_100g",
    "protein_g_per_100g",
    "carbs_g_per_100g",
    "fat_g_per_100g",
    "fibre_g_per_100g",
    "sugar_g_per_100g",
    "sodium_mg_per_100g",
    "default_serving_name",
    "default_serving_g",
  ]) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (typeof body.name === "string") updates.normalized_name = normalizeFoodName(body.name);

  const { data, error } = await supabase.from("foods").update(updates).eq("id", id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ food: data });
}

// PRD §14: editing/deleting a food never changes prior diary nutrition —
// food_log_items are snapshots (kcal/macros copied at log time), so this
// is a plain delete, not something that needs to cascade-recompute history.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
