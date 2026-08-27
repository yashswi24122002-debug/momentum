export type UniversitySource = "manual" | "ai_suggested";
export type UniversityStatus = "researching" | "shortlisted" | "applying" | "applied" | "decision";
export type TaskCategory = "documents" | "exams" | "financial" | "visa" | "application" | "language";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done";

export type FitScores = { gpa: number; budget: number; specialization: number; overall: number };

export type UniversityRequirements = {
  estimated_requirements?: string;
  tuition_estimate?: string;
  fit_scores?: FitScores;
};

export type University = {
  id: string;
  name: string;
  program_name: string | null;
  city: string | null;
  intake_target: string | null;
  deadline_uni_assist: string | null;
  deadline_direct: string | null;
  requirements: UniversityRequirements | null;
  source: UniversitySource;
  verified: boolean;
  status: UniversityStatus;
  fit_notes: string | null;
  /** Real official program page URL — curated match, or a Google search fallback. Never AI-generated. */
  official_url: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  category: TaskCategory | null;
  depends_on: string[];
  status: TaskStatus;
  deadline: string | null;
  university_id: string | null;
  instructions: string | null;
  where_to_apply_url: string | null;
  reminder_sent_30: boolean;
  reminder_sent_14: boolean;
  reminder_sent_7: boolean;
  reminder_sent_1: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Document = {
  id: string;
  name: string;
  file_url: string;
  task_id: string | null;
  university_id: string | null;
  version: number;
  uploaded_at: string;
};

/** Document with a freshly-generated signed URL — the "documents" Storage bucket is private. */
export type DocumentWithUrl = Document & { signed_url: string | null };

export type ReminderLog = {
  id: string;
  task_id: string;
  sent_at: string;
  days_before: number;
};

export type DiscoveryProfile = {
  gpa: string;
  work_experience: string;
  budget: string;
  specialization: string;
  city_preference: string;
};
