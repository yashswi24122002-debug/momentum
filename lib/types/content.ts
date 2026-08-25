export type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  location_summary: string | null;
};

export type Media = {
  id: string;
  file_url: string;
  thumbnail_url: string | null;
  taken_at: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  trip_id: string | null;
  tags: string[] | null;
  content_worthy: boolean;
  rating: number | null;
  uploaded_at: string;
};

/** Media with a freshly-generated signed URL — the "media" Storage bucket is private. */
export type MediaWithUrl = Media & { signed_url: string | null };

export type ContentFormat = "reel" | "carousel";
export type ContentIdeaStatus = "pending" | "approved" | "rejected";
export type ContentLifecycleStatus = "backlog" | "shooting_editing" | "ready" | "posted";
export type ContentRejectionReason = "not_interested" | "too_big" | "seen_before" | "not_feasible";

export type ContentIdea = {
  id: string;
  date_generated: string;
  title: string;
  format: ContentFormat;
  trend_source: string | null;
  trend_signal: string | null;
  matched_media_ids: string[] | null;
  status: ContentIdeaStatus;
  rejection_reason: ContentRejectionReason | null;
  created_at: string;
};

export type ContentReport = {
  id: string;
  content_idea_id: string;
  concept_format: string;
  why_trending: string;
  assets_available: string;
  assets_needed: string;
  caption_draft: string;
  hashtags: string[];
  best_posting_window: string;
  next_action: string;
  lifecycle_status: ContentLifecycleStatus;
  created_at: string;
  updated_at: string;
};
