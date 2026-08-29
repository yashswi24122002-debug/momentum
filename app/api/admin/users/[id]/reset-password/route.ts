import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword } from "@/lib/admin/temp-password";

// Supabase Auth stores passwords as salted hashes — there is no way for
// anyone, including the admin, to view a member's current password. This
// is the practical equivalent: the admin sets a brand-new one, shown once
// in this response only, and the member is forced to change it again on
// their next login (09-Admin-Access-Control-PRD.md §10).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { error: authError } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ tempPassword });
}
