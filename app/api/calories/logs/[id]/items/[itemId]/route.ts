import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Item nutrition was originally treated as an immutable snapshot (delete
// and re-add to correct a mistake) — this route exists because that's a
// worse experience than just fixing the number that's wrong. Direct manual
// edit of the stored snapshot values, same fields the custom/AI-photo
// logging path already lets you enter by hand — no recompute-from-food-id
// magic that could silently change numbers you're not looking at.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id, itemId } = await params;

  // food_log_items has no user_id of its own — ownership derives from its
  // parent food_log, so this has to be checked explicitly before writing.
  const { data: log } = await supabase.from("food_logs").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.quantity === "number" && body.quantity > 0) updates.quantity = body.quantity;
  if (typeof body.serving_label === "string" && body.serving_label.trim()) updates.serving_label = body.serving_label.trim();
  if (typeof body.kcal === "number") updates.kcal = body.kcal;
  if (typeof body.protein_g === "number") updates.protein_g = body.protein_g;
  if (typeof body.carbs_g === "number") updates.carbs_g = body.carbs_g;
  if (typeof body.fat_g === "number") updates.fat_g = body.fat_g;
  if (body.fibre_g === null || typeof body.fibre_g === "number") updates.fibre_g = body.fibre_g;
  if (body.sugar_g === null || typeof body.sugar_g === "number") updates.sugar_g = body.sugar_g;
  if (body.sodium_mg === null || typeof body.sodium_mg === "number") updates.sodium_mg = body.sodium_mg;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("food_log_items")
    .update(updates)
    .eq("id", itemId)
    .eq("food_log_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
