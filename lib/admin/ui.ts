import type { ToolKey, FeatureKey } from "@/lib/types/admin";

export const TOOL_ORDER: ToolKey[] = ["habits", "ideas", "content", "masters_abroad", "jobs", "calories"];
export const TOOL_LABELS: Record<ToolKey, string> = {
  habits: "Habits",
  ideas: "Ideas",
  content: "Content Creation",
  masters_abroad: "Masters Abroad",
  jobs: "Jobs Automation",
  calories: "Calorie Tracker",
};

export const FEATURE_ORDER: FeatureKey[] = [
  "ideas_generate",
  "content_generate",
  "masters_discover",
  "calories_analyse_photo",
  "calories_fetch_details",
  "jobs_draft_outreach",
];
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ideas_generate: "Generate ideas",
  content_generate: "Generate content ideas",
  masters_discover: "Discover universities",
  calories_analyse_photo: "Analyse meal photos",
  calories_fetch_details: "Fetch food nutrition details",
  jobs_draft_outreach: "Draft outreach emails",
};
