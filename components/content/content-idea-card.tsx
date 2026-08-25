"use client";

import { Check, X, Loader2, Film, Images } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import type { ContentIdea } from "@/lib/types/content";

export function ContentIdeaCard({
  idea,
  onApprove,
  onReject,
  approving,
  statusBadge,
}: {
  idea: ContentIdea;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
  statusBadge?: { label: string; tone: StatusTone };
}) {
  const FormatIcon = idea.format === "reel" ? Film : Images;
  const matchedCount = idea.matched_media_ids?.length ?? 0;

  return (
    <Card className="gap-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{idea.title}</h3>
          {statusBadge && <StatusBadge label={statusBadge.label} tone={statusBadge.tone} />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onReject && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-danger hover:bg-danger/10"
              onClick={onReject}
              disabled={approving}
              aria-label="Reject"
            >
              <X className="size-4" />
            </Button>
          )}
          {onApprove && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-primary hover:bg-accent-muted-bg"
              onClick={onApprove}
              disabled={approving}
              aria-label="Approve"
            >
              {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
          )}
        </div>
      </div>
      {idea.trend_signal && <p className="text-sm text-text-secondary">{idea.trend_signal}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-text-muted">
        <span className="flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5">
          <FormatIcon className="size-3" />
          {idea.format}
        </span>
        {idea.trend_source && <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.trend_source}</span>}
        <span className="rounded-full bg-accent-muted-bg px-2 py-0.5 text-primary">
          {matchedCount} matched photo{matchedCount === 1 ? "" : "s"}
        </span>
      </div>
    </Card>
  );
}
