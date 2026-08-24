import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LIFECYCLE_ORDER, LIFECYCLE_LABELS, LIFECYCLE_TONES } from "@/lib/ideas/ui";
import type { IdeaReport } from "@/lib/types/ideas";

export type ReportWithIdea = IdeaReport & {
  ideas: { title: string; one_liner: string; category: string; effort_estimate: string } | null;
};

// Stage is changed from the report detail page only (/ideas/[id]) — this
// board is a read-only overview, not another place to edit from.
export function PipelineBoard({ reports }: { reports: ReportWithIdea[] }) {
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
                <Link key={report.id} href={`/ideas/${report.idea_id}`}>
                  <Card className="gap-1 border-border bg-surface p-3 transition-colors hover:bg-surface-hover">
                    <p className="text-sm font-medium text-text-primary">{report.ideas?.title ?? "Untitled idea"}</p>
                    {report.ideas?.category && (
                      <p className="text-xs text-text-muted">{report.ideas.category}</p>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
