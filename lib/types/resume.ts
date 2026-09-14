export type EducationEntry = { institution: string; detail: string; dates: string };
export type SkillGroup = { category: string; items: string[] };
export type ExperienceEntry = { company: string; location: string; role: string; dates: string; bullets: string[] };
export type ProjectEntry = { name: string; description: string; dates: string };

/** The structured content a resume PDF is rendered from — same shape whether it's the canonical profile or a JD-tailored snapshot. */
export type ResumeContent = {
  name: string;
  email: string | null;
  github: string | null;
  mobile: string | null;
  linkedin: string | null;
  location: string | null;
  education: EducationEntry[];
  skills: SkillGroup[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  honors: string[];
};

export type ResumeProfile = ResumeContent & {
  id: string;
  user_id: string;
  updated_at: string;
};

export type JobApplicationStatus = "draft" | "tailored" | "contact_found" | "sent" | "replied";

export type JobApplication = {
  id: string;
  user_id: string;
  company: string;
  role_title: string;
  jd_text: string;
  url: string | null;
  status: JobApplicationStatus;
  tailored_resume: ResumeContent | null;
  cover_letter_text: string | null;
  contact_email: string | null;
  contact_name: string | null;
  email_subject: string | null;
  email_body_draft: string | null;
  email_body_final: string | null;
  resume_pdf_path: string | null;
  cover_letter_pdf_path: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};
