import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/shared/sidebar-nav";
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

  return (
    <div className="min-h-full">
      <SidebarNav />
      <main className="min-h-full pb-20 md:ml-56 md:pb-0">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  );
}
