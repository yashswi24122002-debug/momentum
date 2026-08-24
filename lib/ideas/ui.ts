import type { IdeaLifecycleStatus, RejectionReason } from "@/lib/types/ideas";
import type { StatusTone } from "@/components/shared/status-badge";

export const LIFECYCLE_ORDER: IdeaLifecycleStatus[] = [
  "backlog",
  "researching",
  "building",
  "shipped",
  "abandoned",
];

export const LIFECYCLE_LABELS: Record<IdeaLifecycleStatus, string> = {
  backlog: "Backlog",
  researching: "Researching",
  building: "Building",
  shipped: "Shipped",
  abandoned: "Abandoned",
};

export const LIFECYCLE_TONES: Record<IdeaLifecycleStatus, StatusTone> = {
  backlog: "neutral",
  researching: "info",
  building: "info",
  shipped: "success",
  abandoned: "danger",
};

export const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "not_interested", label: "Not interested" },
  { value: "too_big", label: "Too big" },
  { value: "seen_before", label: "Seen before" },
  { value: "not_feasible", label: "Not feasible" },
];

/**
 * Signals are tagged "[Source] text" when built for the AI prompt (see
 * app/api/ideas/generate/route.ts) so citations in source_signals keep
 * their provenance. This splits that back out for display.
 */
export function parseSignalSource(signal: string): { source: string | null; text: string } {
  const match = signal.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { source: null, text: signal };
  return { source: match[1], text: match[2] };
}
