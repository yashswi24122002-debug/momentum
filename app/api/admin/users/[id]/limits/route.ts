import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import type { FeatureKey } from "@/lib/types/admin";

const ALL_FEATURES: FeatureKey[] = ["ideas_generate", "content_generate", "masters_discover", "calories_analyse_photo", "jobs_draft_outreach"];

// Body: { limits: { ideas_generate: number | null, ... } } — null means unlimited.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const limits = body.limits as Partial<Record<FeatureKey, number | null>>;

  if (!limits || typeof limits !== "object") {
    return NextResponse.json({ error: "limits is required" }, { status: 400 });
  }

  const rows = ALL_FEATURES.filter((f) => f in limits).map((feature_key) => ({
    user_id: id,
    feature_key,
    daily_limit: limits[feature_key] === null || limits[feature_key] === undefined ? null : Number(limits[feature_key]),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("usage_limits").upsert(rows, { onConflict: "user_id,feature_key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
