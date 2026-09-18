export type LeadArea = "noida" | "ghaziabad" | "greater_noida" | "other";
export type LeadStatus = "new" | "contacted" | "interested" | "proposal_sent" | "won" | "lost";
export type LeadOutreachStatus = "draft" | "approved" | "sent" | "responded";

export type BusinessLead = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  address: string | null;
  area: LeadArea | null;
  phone: string | null;
  email: string | null;
  existing_website: string | null;
  google_rating: number | null;
  google_place_id: string;
  source: string;
  discovered_at: string;
  status: LeadStatus;
};

export type LeadOutreach = {
  id: string;
  user_id: string;
  lead_id: string;
  pitch_subject: string | null;
  pitch_body_draft: string | null;
  pitch_body_final: string | null;
  status: LeadOutreachStatus;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
};

export type LeadOutreachWithLead = LeadOutreach & {
  business_leads: Pick<BusinessLead, "name" | "category" | "area"> | null;
};
