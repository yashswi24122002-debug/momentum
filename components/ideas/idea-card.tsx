"use client";

import { Check, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Idea } from "@/lib/types/ideas";

export function IdeaCard({
  idea,
  onApprove,
  onReject,
  approving,
}: {
  idea: Idea;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}) {
  return (
    <Card className="gap-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{idea.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
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
        </div>
      </div>
      <p className="text-sm text-text-secondary">{idea.one_liner}</p>
      <div className="flex items-center gap-2 pt-1 text-xs text-text-muted">
        <span className="rounded-full bg-surface-hover px-2 py-0.5">{idea.category}</span>
        <span className="rounded-full bg-surface-hover px-2 py-0.5">Effort: {idea.effort_estimate}</span>
      </div>
    </Card>
  );
}
