"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { LIFECYCLE_ORDER, LIFECYCLE_LABELS, LIFECYCLE_TONES } from "@/lib/ideas/ui";
import type { IdeaReport, IdeaLifecycleStatus } from "@/lib/types/ideas";

export type ReportWithIdea = IdeaReport & {
  ideas: { title: string; one_liner: string; category: string; effort_estimate: string } | null;
};

export function PipelineBoard({
  reports,
  onStatusChange,
}: {
  reports: ReportWithIdea[];
  onStatusChange: (reportId: string, status: IdeaLifecycleStatus) => void;
}) {
  if (reports.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
        Approved ideas will show up here, grouped by stage.
      </p>
    );
  }

  return (
    <div className="grid gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
      {LIFECYCLE_ORDER.map((status) => {
        const columnReports = reports.filter((r) => r.lifecycle_status === status);
        return (
          <div key={status} className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <StatusBadge label={LIFECYCLE_LABELS[status]} tone={LIFECYCLE_TONES[status]} />
              <span className="text-xs text-text-muted">{columnReports.length}</span>
            </div>
            <div className="space-y-2">
              {columnReports.map((report) => (
                <Card key={report.id} className="gap-2 border-border bg-surface p-3">
                  <Link href={`/ideas/${report.idea_id}`} className="text-sm font-medium text-text-primary hover:text-primary">
                    {report.ideas?.title ?? "Untitled idea"}
                  </Link>
                  <Select
                    value={report.lifecycle_status}
                    onValueChange={(v) => onStatusChange(report.id, v as IdeaLifecycleStatus)}
                  >
                    <SelectTrigger size="sm" className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LIFECYCLE_LABELS[s]}
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
  );
}
