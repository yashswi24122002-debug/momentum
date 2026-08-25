import type { ContentLifecycleStatus, ContentRejectionReason } from "@/lib/types/content";
import type { StatusTone } from "@/components/shared/status-badge";

export const LIFECYCLE_ORDER: ContentLifecycleStatus[] = ["backlog", "shooting_editing", "ready", "posted"];

export const LIFECYCLE_LABELS: Record<ContentLifecycleStatus, string> = {
  backlog: "Backlog",
  shooting_editing: "Shooting/Editing",
  ready: "Ready",
  posted: "Posted",
};

export const LIFECYCLE_TONES: Record<ContentLifecycleStatus, StatusTone> = {
  backlog: "neutral",
  shooting_editing: "info",
  ready: "warning",
  posted: "success",
};

export const REJECTION_REASONS: { value: ContentRejectionReason; label: string }[] = [
  { value: "not_interested", label: "Not interested" },
  { value: "too_big", label: "Too big" },
  { value: "seen_before", label: "Seen before" },
  { value: "not_feasible", label: "Not feasible" },
];
