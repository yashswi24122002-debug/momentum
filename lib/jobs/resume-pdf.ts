import { jsPDF } from "jspdf";
import type { ResumeContent } from "@/lib/types/resume";

const MARGIN = 16;
const LINE_HEIGHT = 4.6;
const FONT = "helvetica";
const INK = { primary: [16, 24, 22] as const, secondary: [70, 78, 76] as const, muted: [110, 118, 116] as const };

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "resume"
  );
}

/**
 * Renders ResumeContent to a PDF via ONE fixed template — this is what
 * "tailor without changing format" actually means in practice: the AI only
 * ever edits the underlying data (lib/jobs/tailor-prompt.ts), never a
 * document's bytes, so a tailored resume is guaranteed to look exactly
 * like the original, just with different words in the same places. Same
 * jsPDF pattern as lib/ideas/export-pdf.ts (the only other PDF export in
 * this app), styled to mirror a typical one-page ATS resume layout: a
 * two-column header line (bold left / plain right), then Education,
 * Skills, Experience, Projects, Honors — each a bold section heading with
 * a rule underneath.
 */
export function renderResumePdf(resume: ResumeContent): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  function ensureSpace(nextBlockHeight: number) {
    if (y + nextBlockHeight > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function setInk(color: readonly [number, number, number]) {
    doc.setTextColor(color[0], color[1], color[2]);
  }

  /** A line with bold text on the left and plain text on the right (name+contact rows, company+location, role+dates). */
  function twoColLine(left: string, right: string, leftSize: number, leftBold: boolean, rightSize = 9.5) {
    ensureSpace(LINE_HEIGHT + 1);
    doc.setFont(FONT, leftBold ? "bold" : "normal");
    doc.setFontSize(leftSize);
    setInk(INK.primary);
    doc.text(left, MARGIN, y);
    if (right) {
      doc.setFont(FONT, "normal");
      doc.setFontSize(rightSize);
      setInk(INK.muted);
      doc.text(right, pageWidth - MARGIN, y, { align: "right" });
    }
    y += LINE_HEIGHT + (leftSize > 11 ? 1.5 : 0.5);
  }

  function heading(text: string) {
    ensureSpace(LINE_HEIGHT + 4);
    y += 2;
    doc.setFont(FONT, "bold");
    doc.setFontSize(10.5);
    setInk(INK.primary);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 1.2;
    doc.setDrawColor(200, 206, 203);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += LINE_HEIGHT - 1;
  }

  function bullet(text: string, indent = 4) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.3);
    setInk(INK.secondary);
    const lines: string[] = doc.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line, i) => {
      ensureSpace(LINE_HEIGHT);
      doc.text(i === 0 ? `• ${line}` : `  ${line}`, MARGIN + indent, y);
      y += LINE_HEIGHT;
    });
  }

  // Header: name, then a contact line, both centered — matches a typical
  // one-page resume's letterhead rather than the two-column body rows.
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setInk(INK.primary);
  doc.text(resume.name || "Resume", pageWidth / 2, y, { align: "center" });
  y += 7;

  const contactParts = [resume.email, resume.mobile, resume.github, resume.linkedin, resume.location].filter(Boolean);
  if (contactParts.length > 0) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    setInk(INK.muted);
    doc.text(contactParts.join("  ·  "), pageWidth / 2, y, { align: "center" });
    y += 6;
  } else {
    y += 2;
  }

  if (resume.education.length > 0) {
    heading("Education");
    for (const edu of resume.education) {
      twoColLine(edu.institution, edu.dates, 10, true);
      if (edu.detail) {
        doc.setFont(FONT, "italic");
        doc.setFontSize(9.3);
        setInk(INK.secondary);
        ensureSpace(LINE_HEIGHT);
        doc.text(edu.detail, MARGIN, y);
        y += LINE_HEIGHT;
      }
    }
  }

  if (resume.skills.length > 0) {
    heading("Skills");
    for (const group of resume.skills) {
      bullet(`${group.category}: ${group.items.join(", ")}`, 0);
    }
  }

  if (resume.experience.length > 0) {
    heading("Experience");
    for (const job of resume.experience) {
      twoColLine(job.company, job.location, 10.5, true);
      twoColLine(job.role, job.dates, 9.5, false, 9);
      for (const b of job.bullets) bullet(b);
      y += 1.5;
    }
  }

  if (resume.projects.length > 0) {
    heading("Projects");
    for (const project of resume.projects) {
      bullet(`${project.name}: ${project.description} (${project.dates})`, 0);
    }
  }

  if (resume.honors.length > 0) {
    heading("Honors and Awards");
    for (const honor of resume.honors) bullet(honor, 0);
  }

  return doc;
}

export function downloadResumePdf(resume: ResumeContent) {
  renderResumePdf(resume).save(`${slugify(resume.name)}-resume.pdf`);
}

export function resumePdfBlob(resume: ResumeContent): Blob {
  return renderResumePdf(resume).output("blob");
}
