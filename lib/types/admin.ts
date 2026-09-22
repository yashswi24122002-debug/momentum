export type UserRole = "admin" | "member";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  must_change_password: boolean;
  created_at: string;
};

export type ToolKey = "habits" | "ideas" | "content" | "masters_abroad" | "jobs" | "calories" | "local_leads";

export type ToolAccess = {
  id: string;
  user_id: string;
  tool_key: ToolKey;
  enabled: boolean;
};

export type FeatureKey =
  | "ideas_generate"
  | "content_generate"
  | "masters_discover"
  | "calories_analyse_photo"
  | "calories_fetch_details"
  | "jobs_draft_outreach"
  | "jobs_tailor_application"
  | "leads_draft_pitch"
  | "leads_discover";

export type UsageLimit = {
  id: string;
  user_id: string;
  feature_key: FeatureKey;
  daily_limit: number | null;
};

export type UsageCounter = {
  user_id: string;
  feature_key: FeatureKey;
  usage_date: string;
  count: number;
};
