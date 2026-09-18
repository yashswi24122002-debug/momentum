"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/swr-fetcher";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_AREA_LABELS } from "@/lib/leads/ui";
import type { BusinessLead, LeadStatus } from "@/lib/types/leads";

export function PipelineBoard() {
  const { data, mutate } = useSWR<{ leads: BusinessLead[] }>("/api/leads", fetcher);
  const leads = data?.leads ?? null;

  async function changeStatus(lead: BusinessLead, status: LeadStatus) {
    mutate((prev) => prev && { leads: prev.leads.map((l) => (l.id === lead.id ? { ...l, status } : l)) }, { revalidate: false });
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Couldn't update that — try again.");
      mutate();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/local-leads" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Pipeline</h1>
      </div>

      {leads === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEAD_STATUS_ORDER.map((status) => {
            const inStatus = leads.filter((l) => l.status === status);
            return (
              <div key={status} className="space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">
                  {LEAD_STATUS_LABELS[status]} ({inStatus.length})
                </h2>
                <div className="space-y-2">
                  {inStatus.map((lead) => (
                    <Card key={lead.id} className="gap-1.5 border-border bg-surface p-3">
                      <p className="truncate text-sm text-text-primary">{lead.name}</p>
                      <p className="truncate text-xs text-text-muted">
                        {[lead.category, lead.area && LEAD_AREA_LABELS[lead.area]].filter(Boolean).join(" · ")}
                      </p>
                      <Select value={lead.status} onValueChange={(v) => v && changeStatus(lead, v as LeadStatus)}>
                        <SelectTrigger size="sm" className="mt-1 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {LEAD_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Card>
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
