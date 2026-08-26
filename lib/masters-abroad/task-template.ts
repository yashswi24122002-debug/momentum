import type { TaskCategory } from "@/lib/types/masters-abroad";

/**
 * Default task template (Masters Abroad PRD §2 setup step 1) — MS
 * Cybersecurity applications to Germany, Winter intake. Dependencies use a
 * local `key` since real task IDs don't exist until seeded; the seed route
 * resolves keys to IDs in dependency order.
 */
export type TaskTemplateItem = {
  key: string;
  title: string;
  category: TaskCategory;
  dependsOnKeys: string[];
  instructions?: string;
};

export const DEFAULT_TASK_TEMPLATE: TaskTemplateItem[] = [
  { key: "transcripts", title: "Academic transcripts", category: "documents", dependsOnKeys: [] },
  {
    key: "aps",
    title: "APS certificate",
    category: "documents",
    dependsOnKeys: ["transcripts"],
    instructions: "Required for Indian applicants to German universities — apply through APS India well ahead of uni-assist deadlines, processing can take weeks.",
  },
  { key: "sop", title: "Statement of Purpose (SOP)", category: "documents", dependsOnKeys: [] },
  { key: "lors", title: "Letters of Recommendation (LORs)", category: "documents", dependsOnKeys: [] },
  { key: "cv", title: "CV / Resume", category: "documents", dependsOnKeys: [] },
  { key: "language_test", title: "IELTS / TOEFL", category: "language", dependsOnKeys: [] },
  {
    key: "blocked_account",
    title: "Blocked account (Sperrkonto)",
    category: "financial",
    dependsOnKeys: [],
    instructions: "Proof of funds required for the visa — set up via Fintiba, Expatrio, or a partner bank.",
  },
  { key: "health_insurance", title: "Health insurance", category: "visa", dependsOnKeys: [] },
  {
    key: "uni_assist",
    title: "uni-assist application",
    category: "application",
    dependsOnKeys: ["transcripts", "aps", "sop", "lors", "cv", "language_test"],
    instructions: "Submit once all core documents are ready — uni-assist reviews and forwards to universities.",
  },
  {
    key: "visa_appointment",
    title: "Visa appointment",
    category: "visa",
    dependsOnKeys: ["blocked_account", "uni_assist"],
    instructions: "Book early — German consulate visa appointment slots fill up months in advance.",
  },
];
