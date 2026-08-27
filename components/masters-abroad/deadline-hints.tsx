import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Static general-knowledge reference, not university-specific data — this
 * is deliberately NOT AI-generated (unlike a fake specific date, a general
 * pattern like this is stable public knowledge, safe to hardcode).
 */
export function DeadlineHints() {
  return (
    <Card className="flex flex-row items-start gap-2 border-border bg-surface p-3 text-xs text-text-secondary">
      <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
      <p>
        For German Winter intake, most <strong className="text-text-primary">uni-assist</strong> deadlines cluster
        around <strong className="text-text-primary">mid-July</strong> (some as early as May, a few as late as
        August/September) — direct-application universities vary more widely. Use this as a rough sanity check while
        verifying, not a substitute for the actual deadline on each university&apos;s official page.
      </p>
    </Card>
  );
}
