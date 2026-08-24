import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Master PRD §5 component conventions — one color mapping for pipeline/status
 * badges reused across every tool: backlog/new = gray, in progress = info
 * blue, blocked/attention = warning amber, done/success = accent green,
 * rejected/abandoned = danger red (muted).
 */
export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface-hover text-text-secondary",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-accent-muted-bg text-primary",
  danger: "bg-danger/15 text-danger",
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", TONE_CLASSES[tone], className)}>
      {label}
    </Badge>
  );
}
