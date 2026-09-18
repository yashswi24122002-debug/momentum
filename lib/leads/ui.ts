import type { LeadStatus, LeadOutreachStatus, LeadArea } from "@/lib/types/leads";
import type { StatusTone } from "@/components/shared/status-badge";

export const LEAD_AREA_ORDER: LeadArea[] = ["noida", "ghaziabad", "greater_noida", "other"];
export const LEAD_AREA_LABELS: Record<LeadArea, string> = {
  noida: "Noida",
  ghaziabad: "Ghaziabad",
  greater_noida: "Greater Noida",
  other: "Other",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = ["new", "contacted", "interested", "proposal_sent", "won", "lost"];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  proposal_sent: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};
export const LEAD_STATUS_TONES: Record<LeadStatus, StatusTone> = {
  new: "neutral",
  contacted: "info",
  interested: "info",
  proposal_sent: "warning",
  won: "success",
  lost: "danger",
};

export const OUTREACH_STATUS_ORDER: LeadOutreachStatus[] = ["draft", "approved", "sent", "responded"];
export const OUTREACH_STATUS_LABELS: Record<LeadOutreachStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  responded: "Responded",
};
export const OUTREACH_STATUS_TONES: Record<LeadOutreachStatus, StatusTone> = {
  draft: "neutral",
  approved: "info",
  sent: "success",
  responded: "success",
};
