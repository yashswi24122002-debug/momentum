import { jsPDF } from "jspdf";
import type { ResumeContent } from "@/lib/types/resume";

const MARGIN = 14;
const FONT = "times";
const INK = { primary: [10, 10, 10] as const, secondary: [30, 30, 30] as const, muted: [60, 60, 60] as const };

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
 * Mirrors the user's actual LaTeX resume format (the classic "xprilion"
 * one-page template — resumeFormat.md is its source) as closely as jsPDF's
 * primitives allow: a dense, tightly-spaced single page, a 3-row header
 * (name+email / github+mobile / linkedin+location, not centered), and
 * education's dates on the detail line rather than next to the
 * institution name. `scale` shrinks every size/spacing uniformly —
 * renderResumePdfFitted() below re-renders at a smaller scale until it
 * actually fits on one page, rather than silently spilling to a second.
 */
function buildDoc(resume: ResumeContent, scale: number): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const rightX = pageWidth - MARGIN;
  let y = MARGIN;

  const sz = (pt: number) => Math.max(6, pt * scale);
  const gap = (mm: number) => mm * scale;

  // jsPDF never paginates on its own — text drawn past the bottom margin
  // just gets clipped, not pushed to a new page — so without this,
  // getNumberOfPages() in renderResumePdf() below would always report 1
  // and the shrink-to-fit retry would never actually trigger.
  function ensureSpace(nextBlockHeight: number) {
    if (y + nextBlockHeight > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function setInk(color: readonly [number, number, number]) {
    doc.setTextColor(color[0], color[1], color[2]);
  }

  function twoCol(
    left: string,
    right: string,
    opts: { leftSize: number; leftBold?: boolean; leftItalic?: boolean; rightSize?: number; rightItalic?: boolean }
  ) {
    const lineHeight = gap(opts.leftSize * 0.42);
    ensureSpace(lineHeight);
    doc.setFont(FONT, opts.leftBold ? "bold" : opts.leftItalic ? "italic" : "normal");
    doc.setFontSize(sz(opts.leftSize));
    setInk(INK.primary);
    doc.text(left, MARGIN, y);
    if (right) {
      doc.setFont(FONT, opts.rightItalic ? "italic" : "normal");
      doc.setFontSize(sz(opts.rightSize ?? opts.leftSize));
      setInk(INK.muted);
      doc.text(right, rightX, y, { align: "right" });
    }
    y += lineHeight;
  }

  function heading(text: string) {
    ensureSpace(gap(9));
    y += gap(3);
    doc.setFont(FONT, "bold");
    doc.setFontSize(sz(12));
    setInk(INK.primary);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += gap(1);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, rightX, y);
    y += gap(4.2);
  }

  function bullet(text: string) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(sz(9.3));
    setInk(INK.secondary);
    const indent = gap(4);
    const lineHeight = gap(3.9);
    const lines: string[] = doc.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line, i) => {
      ensureSpace(lineHeight);
      doc.text(i === 0 ? `• ${line}` : `  ${line}`, MARGIN + indent, y);
      y += lineHeight;
    });
    y += gap(0.4);
  }

  // ---- Header: 3 rows, name/email, github/mobile, linkedin/location ----
  twoCol(resume.name || "Resume", resume.email ?? "", { leftSize: 17, leftBold: true, rightSize: 9.5 });
  twoCol(resume.github ?? "", resume.mobile ?? "", { leftSize: 9.5, rightSize: 9.5 });
  twoCol(resume.linkedin ?? "", resume.location ?? "", { leftSize: 9.5, rightSize: 9.5 });
  y += gap(1);

  if (resume.education.length > 0) {
    heading("Education");
    for (const edu of resume.education) {
      twoCol(edu.institution, "", { leftSize: 10, leftBold: true });
      if (edu.detail || edu.dates) {
        twoCol(edu.detail, edu.dates, { leftSize: 9.3, leftItalic: true, rightItalic: true });
      }
      y += gap(1);
    }
  }

  if (resume.skills.length > 0) {
    heading("Skills Summary");
    for (const group of resume.skills) {
      bullet(`${group.category}: ${group.items.join(", ")}`);
    }
  }

  if (resume.experience.length > 0) {
    heading("Experience");
    for (const job of resume.experience) {
      twoCol(job.company, job.location, { leftSize: 10.2, leftBold: true });
      twoCol(job.role, job.dates, { leftSize: 9.3, leftItalic: true, rightItalic: true });
      y += gap(0.6);
      for (const b of job.bullets) bullet(b);
      y += gap(1.2);
    }
  }

  if (resume.projects.length > 0) {
    heading("Projects");
    for (const project of resume.projects) {
      bullet(`${project.name}: ${project.description} (${project.dates})`);
      y += gap(0.8);
    }
  }

  if (resume.honors.length > 0) {
    heading("Honors and Awards");
    for (const honor of resume.honors) bullet(honor);
  }

  return doc;
}

/** Re-renders at progressively smaller scale until it actually fits one page, instead of silently spilling to a second. */
export function renderResumePdf(resume: ResumeContent): jsPDF {
  const scales = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];
  let last = buildDoc(resume, scales[0]);
  for (const scale of scales) {
    const doc = buildDoc(resume, scale);
    if (doc.getNumberOfPages() <= 1) return doc;
    last = doc;
  }
  return last; // smallest attempted — still readable even if content genuinely can't fit one page
}

export function downloadResumePdf(resume: ResumeContent) {
  renderResumePdf(resume).save(`${slugify(resume.name)}-resume.pdf`);
}

/** Opens the PDF in a new tab for viewing — no file gets saved to disk. */
export function previewResumePdf(resume: ResumeContent) {
  renderResumePdf(resume).output("dataurlnewwindow");
}

export function resumePdfBlob(resume: ResumeContent): Blob {
  return renderResumePdf(resume).output("blob");
}
