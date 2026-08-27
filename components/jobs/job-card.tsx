import { ExternalLink, MapPin, Trash2, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { JOB_STATUS_LABELS, JOB_STATUS_TONES, fitScoreTone } from "@/lib/jobs/ui";
import type { JobPosting } from "@/lib/types/jobs";

export function JobCard({
  job,
  onMarkReviewed,
  onDismiss,
  onDelete,
  onDraftOutreach,
}: {
  job: JobPosting;
  onMarkReviewed?: () => void;
  onDismiss?: () => void;
  onDelete: () => void;
  onDraftOutreach: () => void;
}) {
  return (
    <Card className="gap-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{job.role_title}</h3>
          <p className="text-xs text-text-secondary">{job.company}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {job.location}
          </span>
        )}
        {job.remote && <span className="rounded-full bg-accent-muted-bg px-2 py-0.5 text-primary">Remote</span>}
        <span className="capitalize">{job.source}</span>
      </div>

      {job.fit_score !== null && (
        <p className={`text-sm font-semibold ${fitScoreTone(job.fit_score)}`}>{job.fit_score}/100 fit</p>
      )}

      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          View posting
        </a>
      )}

      <div className="flex items-center gap-2 pt-1">
        <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
        <div className="ml-auto flex items-center gap-2">
          {job.status === "new" && onMarkReviewed && (
            <Button variant="outline" size="sm" onClick={onMarkReviewed}>
              Mark reviewed
            </Button>
          )}
          {job.status !== "dismissed" && onDismiss && (
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          <Button size="sm" onClick={onDraftOutreach}>
            <Send className="size-3.5" />
            Draft outreach
          </Button>
        </div>
      </div>
    </Card>
  );
}
