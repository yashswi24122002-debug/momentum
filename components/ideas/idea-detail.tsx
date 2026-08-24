"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LIFECYCLE_ORDER, LIFECYCLE_LABELS, parseSignalSource } from "@/lib/ideas/ui";
import type { Idea, IdeaReport, IdeaLifecycleStatus } from "@/lib/types/ideas";

type IdeaWithReports = Idea & { idea_reports: IdeaReport[] };

const REPORT_FIELDS: { key: keyof IdeaReport; label: string }[] = [
  { key: "scope", label: "Scope" },
  { key: "target_audience", label: "Target audience" },
  { key: "plan", label: "Plan (first month)" },
  { key: "reliability_doability", label: "Reliability & doability" },
  { key: "next_action", label: "Next action" },
  { key: "competitive_landscape", label: "Competitive landscape" },
  { key: "cost_estimate", label: "Cost estimate" },
];

export function IdeaDetail({ ideaId }: { ideaId: string }) {
  const [idea, setIdea] = useState<IdeaWithReports | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setIdea(json.idea))
      .catch(() => setIdea(null));
  }, [ideaId]);

  async function handleStatusChange(reportId: string, status: IdeaLifecycleStatus) {
    if (!idea) return;
    const previous = idea;
    setIdea({ ...idea, idea_reports: idea.idea_reports.map((r) => (r.id === reportId ? { ...r, lifecycle_status: status } : r)) });
    const res = await fetch(`/api/idea-reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifecycle_status: status }),
    });
    if (!res.ok) {
      setIdea(previous);
      toast.error("Couldn't update the stage — try again.");
    }
  }

  if (idea === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (idea === null) {
    return <p className="text-sm text-text-secondary">Idea not found.</p>;
  }

  const report = idea.idea_reports[0];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/ideas" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">{idea.title}</h1>
      </div>

      <Card className="border-border bg-surface">
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm text-text-secondary">{idea.one_liner}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.category}</span>
            <span className="rounded-full bg-surface-hover px-2 py-0.5">Effort: {idea.effort_estimate}</span>
          </div>
          {idea.explainer && (
            <div className="flex items-start gap-2 rounded-lg bg-background p-3 pt-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
              <p className="text-xs text-text-secondary">{idea.explainer}</p>
            </div>
          )}
          {idea.source_signals && idea.source_signals.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-text-muted">Inspired by</p>
              <ul className="space-y-1 text-xs text-text-secondary">
                {idea.source_signals.map((s, i) => {
                  const { source, text } = parseSignalSource(s);
                  return (
                    <li key={i} className="flex items-start gap-1.5">
                      {source && (
                        <span className="mt-px shrink-0 rounded-full bg-accent-muted-bg px-1.5 py-0.5 text-[10px] text-primary">
                          {source}
                        </span>
                      )}
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {!report ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
          This idea hasn&apos;t been approved yet — no report to show.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Stage</span>
            <Select value={report.lifecycle_status} onValueChange={(v) => handleStatusChange(report.id, v as IdeaLifecycleStatus)}>
              <SelectTrigger className="w-48">
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
            <span className="ml-auto text-sm text-text-secondary">
              Impact/effort score: <span className="font-semibold text-primary">{report.effort_impact_score}/10</span>
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {REPORT_FIELDS.map(({ key, label }) => (
              <Card key={key} className="border-border bg-surface">
                <CardHeader>
                  <CardTitle className="text-xs font-medium text-text-muted">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm text-text-primary">{String(report[key])}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
