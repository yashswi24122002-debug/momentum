import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const [{ data: profile, error }, { data: toolAccess }, { data: limits }, { data: apiKey }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("tool_access").select("*").eq("user_id", id),
    supabase.from("usage_limits").select("*").eq("user_id", id),
    supabase.from("user_api_keys").select("id, provider, updated_at").eq("user_id", id).eq("provider", "gemini").maybeSingle(),
  ]);

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ profile, toolAccess: toolAccess ?? [], limits: limits ?? [], hasApiKey: !!apiKey });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.display_name === "string") updates.display_name = body.display_name.trim() || null;

  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim();
    // auth.users is the source of truth for login; profiles.email is kept
    // in sync alongside it so the rest of the admin UI never shows a stale
    // address. email_confirm skips the verification-link step since this
    // is an admin-initiated change, not member self-service.
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    updates.email = email;
  }

  const { data, error } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

// Fully removes the account — auth.users cascade-deletes profiles and
// every per-user row across every tool (all now `on delete cascade`).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
