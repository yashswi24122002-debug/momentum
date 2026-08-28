import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getAdminProfile } from "@/lib/supabase/admin-guard";

export default async function AdminPage() {
  const profile = await getAdminProfile();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold text-text-primary">Admin</h1>

      <Card className="max-w-md gap-2 border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="size-5" />
          <span className="text-sm font-medium">Admin access confirmed</span>
        </div>
        <p className="text-sm text-text-secondary">Signed in as {profile?.email}.</p>
        <p className="text-xs text-text-muted">
          User management, per-tool access, usage limits, and per-user Gemini API keys are coming in the next phases.
        </p>
      </Card>
    </div>
  );
}
