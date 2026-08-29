import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/supabase/admin-guard";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { MobileHeader } from "@/components/shared/mobile-header";
import { BottomTabBar } from "@/components/shared/bottom-tab-bar";

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

  const { profile, isAdmin, enabledTools } = await getSessionContext();

  // Defense-in-depth alongside the middleware's equivalent check — this
  // one only guards page rendering, not the redirect itself (middleware
  // already handles that before this layout even runs).
  if (profile?.must_change_password) {
    redirect("/change-password");
  }

  return (
    <div className="min-h-full">
      <SidebarNav isAdmin={isAdmin} enabledTools={enabledTools} />
      <MobileHeader isAdmin={isAdmin} enabledTools={enabledTools} />
      <main className="min-h-full pt-14 pb-20 md:ml-56 md:pt-0 md:pb-0">
        <div className="flex min-h-full w-full flex-col px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <BottomTabBar isAdmin={isAdmin} enabledTools={enabledTools} />
    </div>
  );
}
