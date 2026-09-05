"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { OutreachCard } from "@/components/jobs/outreach-card";
import { fetcher } from "@/lib/swr-fetcher";
import { OUTREACH_STATUS_ORDER, OUTREACH_STATUS_LABELS } from "@/lib/jobs/ui";
import type { Outreach } from "@/lib/types/jobs";

type OutreachWithJob = Outreach & { job_postings: { company: string; role_title: string; url: string | null } | null };

export function OutreachQueue() {
  const { data, mutate } = useSWR<{ outreach: OutreachWithJob[] }>("/api/outreach", fetcher);
  const outreach = data?.outreach ?? null;

  async function patchOutreach(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/outreach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      return;
    }
    const { outreach: updated } = await res.json();
    mutate((prev) => prev && { outreach: prev.outreach.map((o) => (o.id === id ? { ...o, ...updated } : o)) }, {
      revalidate: false,
    });
  }

  async function sendOutreach(id: string) {
    const res = await fetch(`/api/outreach/${id}/send`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't send that email — try again." }));
      toast.error(error, { duration: 10000 });
      return;
    }
    const { outreach: updated } = await res.json();
    mutate((prev) => prev && { outreach: prev.outreach.map((o) => (o.id === id ? { ...o, ...updated } : o)) }, {
      revalidate: false,
    });
    toast.success("Sent.");
  }

  if (outreach === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/jobs" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Outreach queue</h1>
      </div>

      {outreach.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No outreach drafted yet"
          description="Draft an outreach email from a job posting on the feed to get started."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OUTREACH_STATUS_ORDER.map((status) => {
            const inStatus = outreach.filter((o) => o.status === status);
            if (inStatus.length === 0) return null;
            return (
              <div key={status} className="col-span-full space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">
                  {OUTREACH_STATUS_LABELS[status]} ({inStatus.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inStatus.map((o) => (
                    <OutreachCard
                      key={o.id}
                      outreach={o}
                      onSend={() => sendOutreach(o.id)}
                      onSaveEdits={(fields) => patchOutreach(o.id, fields)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
