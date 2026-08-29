import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Called right after supabase.auth.updateUser({password}) succeeds
// client-side — flips must_change_password off so the middleware stops
// redirecting this member to /change-password on every request.
export async function POST() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { error } = await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
