import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { encryptApiKey } from "@/lib/admin/crypto";

// Write-only, by design (PRD §6/§10) — this route never returns the
// plaintext key back, not in GET (there is no GET here) nor in the
// response to this PATCH. /api/admin/users/[id] only ever reports
// hasApiKey: boolean.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const { api_key } = body as { api_key?: string };

  if (typeof api_key !== "string" || !api_key.trim()) {
    return NextResponse.json({ error: "api_key is required" }, { status: 400 });
  }

  const { error } = await supabase.from("user_api_keys").upsert(
    { user_id: id, provider: "gemini", api_key_encrypted: encryptApiKey(api_key.trim()), updated_at: new Date().toISOString() },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("user_api_keys").delete().eq("user_id", id).eq("provider", "gemini");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
