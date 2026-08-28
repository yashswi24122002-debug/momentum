import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/admin";

/**
 * 09-Admin-Access-Control-PRD.md §4/§7: admin status requires BOTH the
 * database role AND a match against the fixed ADMIN_EMAIL env var — a bug
 * that flips `profiles.role` alone (bad migration, direct SQL, an
 * application bug) is not sufficient on its own to grant admin access.
 * Used at the top of every `/api/admin/*` route; the `/admin/*` page
 * layout performs the equivalent check server-side before rendering.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  const isAdmin = profile?.role === "admin" && profile.email === process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  if (!isAdmin) {
    return { supabase, user, profile: profile ?? null, unauthorized: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, user, profile, unauthorized: null };
}

/** Same admin check as requireAdmin(), shaped for a Server Component (no NextResponse) — used by the /admin route group's layout. */
export async function getAdminProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  const isAdmin = profile?.role === "admin" && profile.email === process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  return isAdmin ? profile! : null;
}

/** For any page (not just /admin) that wants to know if the current session is the admin — e.g. to conditionally render the "Admin" nav entry. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getAdminProfile()) !== null;
}
