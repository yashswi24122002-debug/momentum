"use client";

import { useState } from "react";
import { Check, X, Loader2, Info, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseSignalSource } from "@/lib/ideas/ui";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import type { Idea } from "@/lib/types/ideas";

export function IdeaCard({
  idea,
  onApprove,
  onReject,
  onToggleSave,
  onDelete,
  approving,
  statusBadge,
}: {
  idea: Idea;
  onApprove?: () => void;
  onReject?: () => void;
  onToggleSave: () => void;
  onDelete?: () => void;
  approving?: boolean;
  statusBadge?: { label: string; tone: StatusTone };
}) {
  const [showExplainer, setShowExplainer] = useState(false);

  const sources = Array.from(
    new Set((idea.source_signals ?? []).map((s) => parseSignalSource(s).source).filter(Boolean))
  ) as string[];

  return (
    <Card className="gap-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{idea.title}</h3>
          {statusBadge && <StatusBadge label={statusBadge.label} tone={statusBadge.tone} />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-text-muted hover:bg-danger/10 hover:text-danger"
              onClick={onDelete}
              aria-label="Delete"
              title="Delete permanently"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(idea.saved ? "text-warning" : "text-text-muted")}
            onClick={onToggleSave}
            aria-label={idea.saved ? "Unsave" : "Save for later"}
            title={idea.saved ? "Saved for later" : "Save for later"}
          >
            <Star className={cn("size-4", idea.saved && "fill-current")} />
          </Button>
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
      <p className="text-sm text-text-secondary">{idea.one_liner}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-text-muted">
        <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.category}</span>
        <span className="rounded-full bg-surface-hover px-2 py-0.5">Effort: {idea.effort_estimate}</span>
        {sources.map((source) => (
          <span key={source} className="rounded-full bg-accent-muted-bg px-2 py-0.5 text-primary">
            {source}
          </span>
        ))}
        {idea.explainer && (
          <button
            type="button"
            onClick={() => setShowExplainer((v) => !v)}
            className="ml-auto flex items-center gap-1 text-text-secondary hover:text-primary"
          >
            <Info className="size-3.5" />
            {showExplainer ? "Hide" : "What's this?"}
          </button>
        )}
      </div>
      {showExplainer && idea.explainer && (
        <p className="rounded-lg bg-background p-2.5 text-xs text-text-secondary">{idea.explainer}</p>
      )}
    </Card>
  );
}
