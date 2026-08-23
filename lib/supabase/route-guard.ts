import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Every user-facing API route needs this — proxy.ts excludes /api so it
 * never redirects JSON callers to /login, which means each route is
 * responsible for checking its own session.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, unauthorized: null };
}
