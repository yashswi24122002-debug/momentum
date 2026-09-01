import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { todayLocalISODate } from "@/lib/date";

// calorie_settings is an append-only history (supabase/migrations/
// 20260907000000) — GET always returns the most recent version, i.e. the
// goals in effect starting today. Per-date reads (dashboard/history) use
// lib/calories/settings-history.ts instead to resolve what applied on a
// specific past day.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("calorie_settings")
    .select("*")
    .eq("user_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

// Upserts today's version specifically (onConflict user_id+effective_from)
// — a second edit today replaces today's row rather than creating a
// duplicate "effective today" version, but any earlier day's row is left
// untouched so it keeps showing whatever goal actually applied then.
export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { daily_calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, timezone, effective_from } = body as {
    daily_calorie_goal?: number;
    protein_goal_g?: number | null;
    carbs_goal_g?: number | null;
    fat_goal_g?: number | null;
    timezone?: string;
    effective_from?: string;
  };

  if (typeof daily_calorie_goal !== "number" || daily_calorie_goal < 500 || daily_calorie_goal > 10000) {
    return NextResponse.json({ error: "daily_calorie_goal must be between 500 and 10000" }, { status: 400 });
  }

  // "Today" must come from the caller's own browser clock, not the
  // server's — Vercel runs in UTC, so a save made after midnight in the
  // user's own timezone but before midnight UTC would otherwise get
  // stamped with the *previous* calendar day and silently overwrite that
  // day's already-correct history instead of starting a new version today.
  const isValidDate = typeof effective_from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(effective_from);
  const payload = {
    user_id: user.id,
    effective_from: isValidDate ? effective_from : todayLocalISODate(),
    daily_calorie_goal,
    protein_goal_g: protein_goal_g ?? null,
    carbs_goal_g: carbs_goal_g ?? null,
    fat_goal_g: fat_goal_g ?? null,
    timezone: timezone ?? "Asia/Kolkata",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("calorie_settings")
    .upsert(payload, { onConflict: "user_id,effective_from" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
