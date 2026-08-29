import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword } from "@/lib/admin/temp-password";
import type { ToolKey } from "@/lib/types/admin";

const ALL_TOOLS: ToolKey[] = ["habits", "ideas", "content", "masters_abroad", "jobs", "calories"];

export async function GET() {
  const { supabase, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

// Admin-driven account creation — no public signup exists. Returns the
// temp password once, in this response only; it's never stored or shown
// again, so the admin needs to relay it to their friend right away.
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { email, display_name } = body as { email?: string; display_name?: string };

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Couldn't create that account" }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email: email.trim(),
    display_name: display_name?.trim() || null,
    role: "member",
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Every tool starts disabled — the admin turns on what this person should see.
  await admin.from("tool_access").insert(ALL_TOOLS.map((tool_key) => ({ user_id: created.user.id, tool_key, enabled: false })));

  return NextResponse.json({ user: created.user, tempPassword }, { status: 201 });
}
