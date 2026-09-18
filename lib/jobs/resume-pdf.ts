import { jsPDF } from "jspdf";
import type { ResumeContent } from "@/lib/types/resume";

const MARGIN = 14;
// jsPDF's built-in "times" font has broken kerning at bold/larger sizes
// (visibly wide letter-spacing, confirmed by actually rendering and
// inspecting the output) — helvetica is the reliable one.
const FONT = "helvetica";
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
 * Mirrors the user's actual LaTeX resume format (resumeFormat.md) as
 * closely as jsPDF's primitives allow: labelled header fields (Email:/
 * Github:/Mobile:/LinkedIn:/Location:), a filled bullet in front of each
 * Education/Experience subheading block (LaTeX's outer itemize), hollow
 * circle bullets for job description lines (LaTeX's nested itemize —
 * \labelitemii is \circ), small-caps-style section headings (faked: a
 * larger capital first letter followed by smaller capitals, since jsPDF
 * has no real small-caps support), and the same dense, tightly-spaced
 * one-page layout. `scale` shrinks every size/spacing uniformly —
 * renderResumePdf() below re-renders at a smaller scale until it actually
 * fits on one page, rather than silently spilling to a second.
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
    opts: { leftSize: number; leftBold?: boolean; leftItalic?: boolean; rightSize?: number; rightItalic?: boolean; x?: number }
  ) {
    const lineHeight = gap(opts.leftSize * 0.42);
    ensureSpace(lineHeight);
    doc.setFont(FONT, opts.leftBold ? "bold" : opts.leftItalic ? "italic" : "normal");
    doc.setFontSize(sz(opts.leftSize));
    setInk(INK.primary);
    doc.text(left, opts.x ?? MARGIN, y);
    if (right) {
      doc.setFont(FONT, opts.rightItalic ? "italic" : "normal");
      doc.setFontSize(sz(opts.rightSize ?? opts.leftSize));
      setInk(INK.muted);
      doc.text(right, rightX, y, { align: "right" });
    }
    y += lineHeight;
  }

  /** A bulleted 2-line subheading block (Education/Experience) — one filled bullet in front of the whole block, both lines indented under it. */
  function subheadingBlock(
    lines: { left: string; right: string; size: number; bold?: boolean; italic?: boolean }[]
  ) {
    const indent = gap(4.5);
    ensureSpace(gap(lines[0].size * 0.42));
    doc.setFont(FONT, "normal");
    doc.setFontSize(sz(10));
    setInk(INK.primary);
    doc.text("•", MARGIN, y);
    for (const line of lines) {
      if (!line.left && !line.right) continue;
      twoCol(line.left, line.right, { leftSize: line.size, leftBold: line.bold, leftItalic: line.italic, rightItalic: line.italic, x: MARGIN + indent });
    }
  }

  // Fakes small caps (jsPDF has no real small-caps support): a larger
  // capital first letter followed by the rest of the word in smaller
  // capitals — the closest practical approximation of \scshape.
  function heading(text: string) {
    ensureSpace(gap(9));
    y += gap(3);
    const first = text.charAt(0).toUpperCase();
    const rest = text.slice(1).toUpperCase();
    doc.setFont(FONT, "bold");
    setInk(INK.primary);
    doc.setFontSize(sz(12.5));
    doc.text(first, MARGIN, y);
    const firstWidth = doc.getTextWidth(first);
    doc.setFontSize(sz(10));
    doc.text(rest, MARGIN + firstWidth, y);
    y += gap(1);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, rightX, y);
    y += gap(4.2);
  }

  // Greedy word-wrap where the first line has less room than the rest
  // (because a bold label sits in front of it) — doc.splitTextToSize()
  // only supports one width for every line, so a label-aware wrap needs
  // its own loop. Must be called with the doc's font/size already set to
  // what the wrapped text itself will render in, since it measures via
  // getTextWidth().
  function wrapWithFirstLineBudget(text: string, firstLineMax: number, restMax: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    let budget = Math.max(firstLineMax, 10);
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && doc.getTextWidth(candidate) > budget) {
        lines.push(current);
        current = word;
        budget = Math.max(restMax, 10);
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /**
   * A bullet whose leading label renders bold — mirrors the reference
   * template's \textbf{#1}{: #2} pattern (skills categories, project
   * names, and each experience bullet's lead-in phrase are all bold
   * there; a plain bullet() with no label matches honors, which has no
   * bold lead-in in the original).
   */
  function labeledBullet(marker: string, indent: number, label: string, rest: string) {
    const size = sz(9.3);
    const lineHeight = gap(3.9);
    doc.setFontSize(size);

    doc.setFont(FONT, "normal");
    const markerStr = `${marker} `;
    const markerWidth = doc.getTextWidth(markerStr);

    let labelWidth = 0;
    let labelStr = "";
    if (label) {
      doc.setFont(FONT, "bold");
      // Two trailing spaces, not one — jsPDF's measured width for a
      // single space at a bold/normal font boundary sometimes rounds
      // short of the actual rendered gap (visible as text butting
      // straight up against the colon for some labels).
      labelStr = `${label}:  `;
      labelWidth = doc.getTextWidth(labelStr);
    }

    doc.setFont(FONT, "normal");
    const fullWidth = contentWidth - indent;
    const lines = wrapWithFirstLineBudget(rest, fullWidth - markerWidth - labelWidth, fullWidth - markerWidth);

    ensureSpace(lineHeight);
    setInk(INK.secondary);
    doc.setFont(FONT, "normal");
    doc.text(markerStr, MARGIN + indent, y);
    let x = MARGIN + indent + markerWidth;
    if (labelStr) {
      doc.setFont(FONT, "bold");
      setInk(INK.primary);
      doc.text(labelStr, x, y);
      x += labelWidth;
    }
    doc.setFont(FONT, "normal");
    setInk(INK.secondary);
    doc.text(lines[0] ?? "", x, y);
    y += lineHeight;

    for (let i = 1; i < lines.length; i++) {
      ensureSpace(lineHeight);
      doc.text(lines[i], MARGIN + indent + markerWidth, y);
      y += lineHeight;
    }
    y += gap(0.4);
  }

  function bullet(text: string, marker: string, indent: number) {
    labeledBullet(marker, indent, "", text);
  }
  const outerBullet = (text: string) => bullet(text, "•", gap(4));
  const outerLabeledBullet = (label: string, rest: string) => labeledBullet("•", gap(4), label, rest);
  // "◦" (hollow circle, matching LaTeX's nested \circ marker) isn't in
  // jsPDF's built-in font encoding and renders as garbage — "o" is the
  // closest ASCII-safe stand-in.
  const innerLabeledBullet = (label: string, rest: string) => labeledBullet("o", gap(8.5), label, rest);

  // AI-tailored bullets occasionally arrive with their own leading
  // "-"/"*"/bullet character baked into the text — strip it so it never
  // doubles up with the marker this renderer already draws.
  function stripLeadingMarker(text: string): string {
    return text.replace(/^[\s]*[-*•◦]\s*/, "");
  }

  // Bullets are written as "Label: rest of the sentence" (matching the
  // reference template's \resumeItem{label}{rest}) — split on the first
  // ": " so the label can render bold; falls back to an unlabeled bullet
  // if a bullet doesn't follow that shape (e.g. a hand-edited one).
  function splitLabel(text: string): { label: string; rest: string } {
    const cleaned = stripLeadingMarker(text);
    const idx = cleaned.indexOf(": ");
    if (idx <= 0) return { label: "", rest: cleaned };
    return { label: cleaned.slice(0, idx), rest: cleaned.slice(idx + 2) };
  }

  // ---- Header: 3 labelled rows, name+email / github+mobile / linkedin+location ----
  twoCol(resume.name || "Resume", resume.email ? `Email: ${resume.email}` : "", { leftSize: 17, leftBold: true, rightSize: 9.5 });
  twoCol(resume.github ? `Github: ${resume.github}` : "", resume.mobile ? `Mobile: ${resume.mobile}` : "", { leftSize: 9.5, rightSize: 9.5 });
  twoCol(resume.linkedin ? `LinkedIn: ${resume.linkedin}` : "", resume.location ? `Location: ${resume.location}` : "", { leftSize: 9.5, rightSize: 9.5 });
  y += gap(1);

  if (resume.education.length > 0) {
    heading("Education");
    for (const edu of resume.education) {
      subheadingBlock([
        { left: edu.institution, right: "", size: 10, bold: true },
        { left: edu.detail, right: edu.dates, size: 9.3, italic: true },
      ]);
      y += gap(1);
    }
  }

  if (resume.skills.length > 0) {
    heading("Skills Summary");
    for (const group of resume.skills) {
      outerLabeledBullet(group.category, group.items.join(", "));
    }
  }

  if (resume.experience.length > 0) {
    heading("Experience");
    for (const job of resume.experience) {
      subheadingBlock([
        { left: job.company, right: job.location, size: 10.2, bold: true },
        { left: job.role, right: job.dates, size: 9.3, italic: true },
      ]);
      y += gap(0.6);
      for (const b of job.bullets) {
        const { label, rest } = splitLabel(b);
        innerLabeledBullet(label, rest);
      }
      y += gap(1.2);
    }
  }

  if (resume.projects.length > 0) {
    heading("Projects");
    for (const project of resume.projects) {
      outerLabeledBullet(project.name, `${project.description} (${project.dates})`);
      y += gap(0.8);
    }
  }

  if (resume.honors.length > 0) {
    heading("Honors and Awards");
    for (const honor of resume.honors) outerBullet(honor);
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
