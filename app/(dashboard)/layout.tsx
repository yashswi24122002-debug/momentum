import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/supabase/admin-guard";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { MobileHeader } from "@/components/shared/mobile-header";
import type { ToolKey } from "@/lib/types/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The proxy/middleware already resolved role, must-change-password, and
  // enabled tools fresh for this exact request (it has to, to enforce
  // access) — reading its result via headers instead of calling
  // getSessionContext() here skips a second getUser()+profiles+tool_access
  // round trip on every single page nav. Falls back to the real fetch if
  // the headers are missing for any reason (e.g. this layout somehow
  // rendering for a request the proxy didn't see), so this is strictly an
  // optimization, never a weaker check than before.
  const headerList = await headers();
  const headerIsAdmin = headerList.get("x-momentum-is-admin");
  const headerMustChangePassword = headerList.get("x-momentum-must-change-password");
  const headerEnabledTools = headerList.get("x-momentum-enabled-tools");

  let isAdmin: boolean;
  let mustChangePassword: boolean;
  let enabledTools: ToolKey[];

  if (headerIsAdmin !== null && headerMustChangePassword !== null && headerEnabledTools !== null) {
    isAdmin = headerIsAdmin === "1";
    mustChangePassword = headerMustChangePassword === "1";
    enabledTools = headerEnabledTools ? (headerEnabledTools.split(",") as ToolKey[]) : [];
  } else {
    const ctx = await getSessionContext();
    isAdmin = ctx.isAdmin;
    mustChangePassword = ctx.profile?.must_change_password ?? false;
    enabledTools = ctx.enabledTools;
  }

  // Defense-in-depth alongside the middleware's equivalent check — this
  // one only guards page rendering, not the redirect itself (middleware
  // already handles that before this layout even runs).
  if (mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div className="min-h-full">
      <SidebarNav isAdmin={isAdmin} enabledTools={enabledTools} />
      <MobileHeader isAdmin={isAdmin} enabledTools={enabledTools} />
      <main className="min-h-full pt-14 md:ml-56 md:pt-0">
        <div className="flex min-h-full w-full flex-col px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
