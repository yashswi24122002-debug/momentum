import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminProfile } from "@/lib/supabase/admin-guard";

export default async function AdminPage() {
  const profile = await getAdminProfile();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold text-text-primary">Admin</h1>

      <Card className="max-w-md gap-3 border-border bg-surface p-5">
        <p className="text-sm text-text-secondary">Signed in as {profile?.email}.</p>
        <Button render={<Link href="/admin/users" />} nativeButton={false} className="w-fit">
          <Users className="size-4" />
          Manage users
        </Button>
      </Card>
    </div>
  );
}
