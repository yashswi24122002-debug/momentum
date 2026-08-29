import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Meal-level edits only (meal type/label/notes) — item nutrition is an
// immutable snapshot per PRD §14, so correcting an item means deleting and
// re-adding the meal, not patching a logged value in place.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.meal_type === "string") updates.meal_type = body.meal_type;
  if (body.meal_label !== undefined) updates.meal_label = body.meal_label;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await supabase
    .from("food_logs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, food_log_items(*)")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
