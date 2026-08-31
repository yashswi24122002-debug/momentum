import type { UniversityStatus, TaskCategory, DiscoveryCourse } from "@/lib/types/masters-abroad";
import type { StatusTone } from "@/components/shared/status-badge";

export const DISCOVERY_COURSE_ORDER: DiscoveryCourse[] = ["cybersecurity", "ai", "architecture"];

export const DISCOVERY_COURSE_LABELS: Record<DiscoveryCourse, string> = {
  cybersecurity: "MS Cybersecurity",
  ai: "MS Artificial Intelligence",
  architecture: "M.Arch Architecture",
};

/** Shared with the discover API route, which builds its AI prompt from this same text. */
export const DISCOVERY_COURSE_PROMPT: Record<DiscoveryCourse, string> = {
  cybersecurity: "MS Cybersecurity (or closely related — information security, IT security)",
  ai: "MSc/MS Artificial Intelligence (or closely related — Machine Learning, or Data Science with a strong AI focus)",
  architecture: "M.Arch — Master of Architecture (or closely related architecture/urban design)",
};

export const UNIVERSITY_STATUS_ORDER: UniversityStatus[] = ["researching", "shortlisted", "applying", "applied", "decision"];

export const UNIVERSITY_STATUS_LABELS: Record<UniversityStatus, string> = {
  researching: "Researching",
  shortlisted: "Shortlisted",
  applying: "Applying",
  applied: "Applied",
  decision: "Decision",
};

export const UNIVERSITY_STATUS_TONES: Record<UniversityStatus, StatusTone> = {
  researching: "neutral",
  shortlisted: "info",
  applying: "info",
  applied: "warning",
  decision: "success",
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  documents: "Documents",
  exams: "Exams",
  financial: "Financial",
  visa: "Visa",
  application: "Application",
  language: "Language",
};

export const CATEGORY_ORDER: TaskCategory[] = ["documents", "language", "exams", "financial", "application", "visa"];
