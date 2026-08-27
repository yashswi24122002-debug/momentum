import type { JobPostingStatus, OutreachStatus, ApplicationStage } from "@/lib/types/jobs";
import type { StatusTone } from "@/components/shared/status-badge";

export const JOB_STATUS_ORDER: JobPostingStatus[] = ["new", "reviewed", "dismissed"];
export const JOB_STATUS_LABELS: Record<JobPostingStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
};
export const JOB_STATUS_TONES: Record<JobPostingStatus, StatusTone> = {
  new: "info",
  reviewed: "neutral",
  dismissed: "danger",
};

export const OUTREACH_STATUS_ORDER: OutreachStatus[] = ["draft", "approved", "scheduled", "sent", "replied"];
export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  sent: "Sent",
  replied: "Replied",
};
export const OUTREACH_STATUS_TONES: Record<OutreachStatus, StatusTone> = {
  draft: "neutral",
  approved: "info",
  scheduled: "info",
  sent: "success",
  replied: "success",
};

export const APPLICATION_STAGE_ORDER: ApplicationStage[] = [
  "discovered",
  "reviewing",
  "applied_emailed",
  "response",
  "interview",
  "offer",
  "rejected",
];
export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  discovered: "Discovered",
  reviewing: "Reviewing",
  applied_emailed: "Applied / Emailed",
  response: "Response",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};
export const APPLICATION_STAGE_TONES: Record<ApplicationStage, StatusTone> = {
  discovered: "neutral",
  reviewing: "neutral",
  applied_emailed: "info",
  response: "warning",
  interview: "warning",
  offer: "success",
  rejected: "danger",
};

export function fitScoreTone(score: number | null): string {
  if (score === null) return "text-text-muted";
  if (score >= 70) return "text-primary";
  if (score >= 40) return "text-warning";
  return "text-danger";
}
