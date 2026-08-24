export type IdeaStatus = "pending" | "approved" | "rejected";
export type EffortEstimate = "S" | "M" | "L";
export type IdeaLifecycleStatus = "backlog" | "researching" | "building" | "shipped" | "abandoned";
export type RejectionReason = "not_interested" | "too_big" | "seen_before" | "not_feasible";

export type Idea = {
  id: string;
  date_generated: string;
  title: string;
  one_liner: string;
  category: string;
  effort_estimate: EffortEstimate;
  status: IdeaStatus;
  rejection_reason: RejectionReason | null;
  source_signals: string[] | null;
  /** Plain-language explanation of any jargon/tech/trend the idea assumes familiarity with. */
  explainer: string | null;
  created_at: string;
};

export type IdeaReport = {
  id: string;
  idea_id: string;
  scope: string;
  target_audience: string;
  plan: string;
  reliability_doability: string;
  next_action: string;
  competitive_landscape: string;
  cost_estimate: string;
  effort_impact_score: number;
  lifecycle_status: IdeaLifecycleStatus;
  created_at: string;
  updated_at: string;
};
