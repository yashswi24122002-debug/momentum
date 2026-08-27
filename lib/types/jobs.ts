export type JobPostingStatus = "new" | "reviewed" | "dismissed";
export type OutreachStatus = "draft" | "approved" | "scheduled" | "sent" | "replied";
export type ApplicationStage =
  | "discovered"
  | "reviewing"
  | "applied_emailed"
  | "response"
  | "interview"
  | "offer"
  | "rejected";
export type AppliedVia = "email" | "portal";

export type JobPosting = {
  id: string;
  source: string;
  company: string;
  role_title: string;
  location: string | null;
  remote: boolean;
  url: string | null;
  description_raw: string | null;
  tech_stack_tags: string[] | null;
  posted_date: string | null;
  discovered_at: string;
  fit_score: number | null;
  status: JobPostingStatus;
};

export type Resume = {
  id: string;
  name: string;
  file_url: string;
  focus_area: string | null;
};

/** Resume with a freshly-generated signed URL — stored in the private "documents" bucket. */
export type ResumeWithUrl = Resume & { signed_url: string | null };

export type Outreach = {
  id: string;
  job_posting_id: string;
  contact_email: string | null;
  contact_name: string | null;
  resume_id: string | null;
  email_subject: string | null;
  email_body_draft: string | null;
  email_body_final: string | null;
  status: OutreachStatus;
  scheduled_send_at: string | null;
  sent_at: string | null;
  follow_up_due: string | null;
};

export type Application = {
  id: string;
  job_posting_id: string;
  stage: ApplicationStage;
  applied_via: AppliedVia | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
};

/** Normalized shape every job-source integration wrapper returns, before DB insert. */
export type RawJobPosting = {
  source: string;
  company: string;
  role_title: string;
  location: string | null;
  remote: boolean;
  url: string | null;
  description_raw: string | null;
  tech_stack_tags: string[];
  posted_date: string | null;
};
