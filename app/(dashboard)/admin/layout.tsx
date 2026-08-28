import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/supabase/admin-guard";

// Server-side gate for the whole /admin subtree — the "Admin" nav entry
// being hidden from non-admins is cosmetic only; this is the actual
// boundary (09-Admin-Access-Control-PRD.md §7). Redirects quietly rather
// than 404ing so a curious member just lands back in the app, not on a
// page that hints an admin area exists at all.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAdminProfile();
  if (!profile) {
    redirect("/habits");
  }

  return <>{children}</>;
}
