import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Single-row settings table (Master PRD single-user model) — GET returns
// the one row if it exists, or null so the client can show onboarding.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase.from("calorie_settings").select("*").eq("user_id", user.id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

// Upsert-by-first-row: creates the settings row on first save (onboarding),
// updates it thereafter. There's only ever one row for this single-user app.
export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { daily_calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, timezone } = body as {
    daily_calorie_goal?: number;
    protein_goal_g?: number | null;
    carbs_goal_g?: number | null;
    fat_goal_g?: number | null;
    timezone?: string;
  };

  if (typeof daily_calorie_goal !== "number" || daily_calorie_goal < 500 || daily_calorie_goal > 10000) {
    return NextResponse.json({ error: "daily_calorie_goal must be between 500 and 10000" }, { status: 400 });
  }

  const { data: existing } = await supabase.from("calorie_settings").select("id").eq("user_id", user.id).maybeSingle();

  const payload = {
    daily_calorie_goal,
    protein_goal_g: protein_goal_g ?? null,
    carbs_goal_g: carbs_goal_g ?? null,
    fat_goal_g: fat_goal_g ?? null,
    timezone: timezone ?? "Asia/Kolkata",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase.from("calorie_settings").update(payload).eq("id", existing.id).eq("user_id", user.id).select().single()
    : await supabase.from("calorie_settings").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
