"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ListChecks, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { fetcher } from "@/lib/swr-fetcher";
import { APPLICATION_STAGE_ORDER, APPLICATION_STAGE_LABELS, APPLICATION_STAGE_TONES } from "@/lib/jobs/ui";
import type { Application, ApplicationStage } from "@/lib/types/jobs";

type ApplicationWithJob = Application & { job_postings: { company: string; role_title: string; url: string | null } | null };

export function PipelineBoard() {
  const { data, mutate } = useSWR<{ applications: ApplicationWithJob[] }>("/api/applications", fetcher);
  const applications = data?.applications ?? null;

  async function handleStageChange(id: string, stage: ApplicationStage) {
    mutate((prev) => prev && { applications: prev.applications.map((a) => (a.id === id ? { ...a, stage } : a)) }, {
      revalidate: false,
    });
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) toast.error("Couldn't update that — try again.");
  }

  if (applications === null) {
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
        <h1 className="text-xl font-semibold text-text-primary">Pipeline</h1>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No applications yet"
          description="Applications appear here automatically once an outreach email sends, or add one manually after applying on a company portal."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {APPLICATION_STAGE_ORDER.map((stage) => {
            const inStage = applications.filter((a) => a.stage === stage);
            if (inStage.length === 0) return null;
            return (
              <div key={stage} className="space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">
                  {APPLICATION_STAGE_LABELS[stage]} ({inStage.length})
                </h2>
                <div className="space-y-3">
                  {inStage.map((a) => (
                    <Card key={a.id} className="gap-2 border-border bg-surface p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-text-primary">
                            {a.job_postings?.role_title ?? "Unknown role"}
                          </h3>
                          <p className="text-xs text-text-secondary">{a.job_postings?.company}</p>
                        </div>
                        <StatusBadge label={APPLICATION_STAGE_LABELS[a.stage]} tone={APPLICATION_STAGE_TONES[a.stage]} />
                      </div>
                      {a.job_postings?.url && (
                        <a
                          href={a.job_postings.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          View posting
                        </a>
                      )}
                      {a.notes && <p className="text-xs text-text-secondary">{a.notes}</p>}
                      {a.next_action && (
                        <p className="text-xs text-text-muted">
                          Next: {a.next_action}
                          {a.next_action_date ? ` — ${a.next_action_date}` : ""}
                        </p>
                      )}
                      <Select value={a.stage} onValueChange={(v) => v && handleStageChange(a.id, v as ApplicationStage)}>
                        <SelectTrigger size="sm" className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPLICATION_STAGE_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {APPLICATION_STAGE_LABELS[s]}
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
