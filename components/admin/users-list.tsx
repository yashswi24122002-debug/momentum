"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { Profile } from "@/lib/types/admin";

export function UsersList() {
  const [users, setUsers] = useState<Profile[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      setUsers(json.users ?? []);
    }
    load();
  }, []);

  if (users === null) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Users</h1>
        <Button size="sm" render={<Link href="/admin/users/new" />} nativeButton={false}>
          <Plus className="size-3.5" />
          Invite member
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={User} title="No members yet" description="Invite a friend to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Link key={u.id} href={u.role === "admin" ? "#" : `/admin/users/${u.id}`} className={u.role === "admin" ? "pointer-events-none" : ""}>
              <Card className="gap-1.5 border-border bg-surface p-4 hover:border-primary/50">
                <div className="flex items-center gap-2">
                  {u.role === "admin" ? <ShieldCheck className="size-4 text-primary" /> : <User className="size-4 text-text-muted" />}
                  <p className="text-sm font-medium text-text-primary">{u.display_name || u.email}</p>
                </div>
                <p className="text-xs text-text-muted">{u.email}</p>
                {u.role === "admin" ? (
                  <span className="text-xs text-primary">Admin — full access</span>
                ) : u.must_change_password ? (
                  <span className="text-xs text-warning">Hasn&apos;t logged in yet</span>
                ) : (
                  <span className="text-xs text-text-secondary">Member</span>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
