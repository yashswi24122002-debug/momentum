import type { JobApplicationStatus } from "@/lib/types/resume";
import type { StatusTone } from "@/components/shared/status-badge";

export const APPLICATION_STATUS_ORDER: JobApplicationStatus[] = ["draft", "tailored", "contact_found", "sent", "replied"];
export const APPLICATION_STATUS_LABELS: Record<JobApplicationStatus, string> = {
  draft: "Draft",
  tailored: "Resume tailored",
  contact_found: "Contact found",
  sent: "Sent",
  replied: "Replied",
};
export const APPLICATION_STATUS_TONES: Record<JobApplicationStatus, StatusTone> = {
  draft: "neutral",
  tailored: "info",
  contact_found: "info",
  sent: "success",
  replied: "success",
};
