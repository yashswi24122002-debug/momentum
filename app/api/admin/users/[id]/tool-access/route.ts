import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import type { ToolKey } from "@/lib/types/admin";

const ALL_TOOLS: ToolKey[] = ["habits", "ideas", "content", "masters_abroad", "jobs", "calories"];

// Body: { tools: { habits: boolean, ideas: boolean, ... } } — bulk-sets all
// 6 toggles in one call, upserting since a member created before this
// feature existed might be missing rows for tools added later.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const tools = body.tools as Partial<Record<ToolKey, boolean>>;

  if (!tools || typeof tools !== "object") {
    return NextResponse.json({ error: "tools is required" }, { status: 400 });
  }

  const rows = ALL_TOOLS.filter((t) => t in tools).map((tool_key) => ({
    user_id: id,
    tool_key,
    enabled: Boolean(tools[tool_key]),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("tool_access").upsert(rows, { onConflict: "user_id,tool_key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
