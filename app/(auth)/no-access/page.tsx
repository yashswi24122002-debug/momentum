import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/shared/logout-button";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border bg-surface">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent-muted-bg">
            <Lock className="size-5 text-primary" />
          </div>
          <CardTitle className="text-text-primary">No access yet</CardTitle>
          <CardDescription className="text-text-secondary">
            Your account doesn&apos;t have access to that — or to anything yet. Ask the admin to enable a tool for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
