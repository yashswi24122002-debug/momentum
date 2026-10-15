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
  additional_emails: string[];
  created_at: string;
};

export type LeadOutreachWithLead = LeadOutreach & {
  business_leads: Pick<BusinessLead, "name" | "category" | "area" | "email"> | null;
};

export type WebsiteAuditStatus = "pending" | "completed" | "failed";

export type WebsiteAuditScores = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  best_practices: number | null;
};

export type WebsiteAuditVitals = {
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
};

export type WebsiteAuditIssue = {
  id: string;
  category: "performance" | "seo" | "accessibility" | "best_practices";
  severity: "high" | "medium";
  title: string;
  detail: string;
  value: string | null;
};

// The curated, business-readable translation of the raw issues above —
// what actually gets shown in the report/PDF. your_value/good_benchmark
// are plain strings (not always numeric — some checks aren't quantifiable)
// rather than invented placeholder numbers when a real one isn't available.
export type WebsiteAuditFinding = {
  headline: string;
  your_value: string;
  good_benchmark: string;
  business_impact: string;
};

export type WebsiteAuditMeta = {
  title: string | null;
  description: string | null;
  has_viewport: boolean;
  https_valid: boolean;
  has_sitemap: boolean;
  has_robots: boolean;
  response_ms: number;
};

export type WebsiteAudit = {
  id: string;
  user_id: string;
  lead_id: string;
  url: string;
  status: WebsiteAuditStatus;
  scores: WebsiteAuditScores | null;
  core_web_vitals: WebsiteAuditVitals | null;
  screenshot_path: string | null;
  issues: WebsiteAuditIssue[] | null;
  findings: WebsiteAuditFinding[] | null;
  cms_detected: string | null;
  meta: WebsiteAuditMeta | null;
  ai_summary: string | null;
  report_pdf_path: string | null;
  error: string | null;
  requested_at: string;
  completed_at: string | null;
};

// The forward-looking equivalent of WebsiteAudit for a lead with no
// existing site at all — nothing to measure, so this is a short,
// AI-drafted case for why one makes sense plus suggested pages, not a
// technical report.
export type LeadWebsiteProposal = {
  id: string;
  user_id: string;
  lead_id: string;
  why: string | null;
  suggested_pages: string[] | null;
  pdf_path: string | null;
  created_at: string;
};
