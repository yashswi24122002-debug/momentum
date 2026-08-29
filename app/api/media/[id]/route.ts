import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (Array.isArray(body.tags)) updates.tags = body.tags;
  if (typeof body.rating === "number" || body.rating === null) updates.rating = body.rating;
  if (typeof body.content_worthy === "boolean") updates.content_worthy = body.content_worthy;
  if (typeof body.trip_id === "string" || body.trip_id === null) updates.trip_id = body.trip_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("media").update(updates).eq("id", id).eq("user_id", user.id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media: data });
}
