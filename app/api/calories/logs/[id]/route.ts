import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"];

// Meal-level edits (meal type/label/notes) — meal_type is what the
// dashboard's drag-and-drop between meal sections PATCHes to move a whole
// logged entry into a different meal. Item nutrition is a separate
// immutable-by-default snapshot (see the items/[itemId] route for the
// direct-edit exception to that).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.meal_type === "string") {
    if (!VALID_MEAL_TYPES.includes(body.meal_type)) {
      return NextResponse.json({ error: `meal_type must be one of: ${VALID_MEAL_TYPES.join(", ")}` }, { status: 400 });
    }
    updates.meal_type = body.meal_type;
  }
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
