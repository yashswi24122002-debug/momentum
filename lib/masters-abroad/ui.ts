import type { UniversityStatus, TaskCategory } from "@/lib/types/masters-abroad";
import type { StatusTone } from "@/components/shared/status-badge";

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
