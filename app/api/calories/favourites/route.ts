import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table as a dedicated endpoint, but PRD §7's
// "favourites and recents" quick-add path needs somewhere to read/toggle them.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("food_favourites")
    .select("*, foods(id, name, default_serving_name, default_serving_g, kcal_per_100g)")
    .eq("user_id", user.id)
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
  const { food_id } = body as { food_id?: string };

  if (!food_id) {
    return NextResponse.json({ error: "food_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("food_favourites").insert({ food_id }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favourite: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const foodId = searchParams.get("food_id");

  if (!foodId) {
    return NextResponse.json({ error: "food_id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("food_favourites").delete().eq("user_id", user.id).eq("food_id", foodId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
