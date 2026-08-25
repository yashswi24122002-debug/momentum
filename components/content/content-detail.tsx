"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LIFECYCLE_ORDER, LIFECYCLE_LABELS } from "@/lib/content/ui";
import type { ContentIdea, ContentReport, ContentLifecycleStatus, MediaWithUrl } from "@/lib/types/content";

type ContentIdeaDetail = ContentIdea & { content_reports: ContentReport[]; matched_media: MediaWithUrl[] };

const REPORT_FIELDS: { key: keyof ContentReport; label: string }[] = [
  { key: "concept_format", label: "Concept & format" },
  { key: "why_trending", label: "Why it's trending" },
  { key: "assets_available", label: "Assets available" },
  { key: "assets_needed", label: "Assets needed" },
  { key: "caption_draft", label: "Caption draft" },
  { key: "best_posting_window", label: "Best posting window" },
  { key: "next_action", label: "Next action" },
];

export function ContentDetail({ ideaId }: { ideaId: string }) {
  const [idea, setIdea] = useState<ContentIdeaDetail | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/content/${ideaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setIdea(json.content_idea))
      .catch(() => setIdea(null));
  }, [ideaId]);

  async function handleStatusChange(reportId: string, status: ContentLifecycleStatus) {
    if (!idea) return;
    const previous = idea;
    setIdea({
      ...idea,
      content_reports: idea.content_reports.map((r) => (r.id === reportId ? { ...r, lifecycle_status: status } : r)),
    });
    const res = await fetch(`/api/content-reports/${reportId}`, {
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

  const report = idea.content_reports[0];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/content" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">{idea.title}</h1>
      </div>

      <Card className="border-border bg-surface">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.format}</span>
            {idea.trend_source && <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.trend_source}</span>}
          </div>
          {idea.trend_signal && (
            <p className="text-sm text-text-secondary">
              {idea.trend_signal
                .replace(/\s*\(https:\/\/youtu\.be\/[\w-]+\)/, "")
                .replace(/\s*\(https:\/\/www\.reddit\.com\/r\/\S+\)/, "")}
            </p>
          )}
          {idea.reference_links.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {idea.reference_links.map((ref) => (
                <a
                  key={ref.url}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  {ref.source}
                </a>
              ))}
            </div>
          )}

          {idea.matched_media.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
              {idea.matched_media.map((m) => (
                <div key={m.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-hover">
                  {m.signed_url && (
                    <Image src={m.signed_url} alt={m.location_name ?? "Matched photo"} fill className="object-cover" unoptimized />
                  )}
                </div>
              ))}
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
            <Select
              value={report.lifecycle_status}
              onValueChange={(v) => handleStatusChange(report.id, v as ContentLifecycleStatus)}
            >
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
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="text-xs font-medium text-text-muted">Hashtags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {report.hashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent-muted-bg px-2 py-0.5 text-xs text-primary">
                    #{tag}
                  </span>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
