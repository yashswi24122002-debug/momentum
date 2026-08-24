import { jsPDF } from "jspdf";
import { LIFECYCLE_LABELS } from "@/lib/ideas/ui";
import type { Idea, IdeaReport } from "@/lib/types/ideas";

const MARGIN = 18;
const BODY_LINE_HEIGHT = 5.2;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "idea-report"
  );
}

export function exportIdeaReportPdf(idea: Idea, report: IdeaReport) {
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

  function addLines(text: string, lineHeight: number) {
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  }

  function addHeading(text: string) {
    ensureSpace(BODY_LINE_HEIGHT + 5);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(16, 24, 22);
    doc.text(text, MARGIN, y);
    y += BODY_LINE_HEIGHT;
    doc.setDrawColor(220, 224, 222);
    doc.line(MARGIN, y - 3.5, pageWidth - MARGIN, y - 3.5);
  }

  function addBody(text: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(45, 52, 50);
    addLines(text, BODY_LINE_HEIGHT);
    y += 2;
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(16, 24, 22);
  addLines(idea.title, 7.5);
  y += 1;

  // One-liner
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 88, 86);
  addLines(idea.one_liner, 5.8);
  y += 2;

  // Meta line
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120, 128, 126);
  doc.text(
    `${idea.category}  ·  Effort ${idea.effort_estimate}  ·  Impact/effort ${report.effort_impact_score}/10  ·  Stage: ${LIFECYCLE_LABELS[report.lifecycle_status]}`,
    MARGIN,
    y
  );
  y += 9;

  if (idea.explainer) {
    addHeading("Context");
    addBody(idea.explainer);
  }

  const sections: { heading: string; body: string }[] = [
    { heading: "Scope", body: report.scope },
    { heading: "Target audience", body: report.target_audience },
    { heading: "Plan (first month)", body: report.plan },
    { heading: "Reliability & doability", body: report.reliability_doability },
    { heading: "Next action", body: report.next_action },
    { heading: "Competitive landscape", body: report.competitive_landscape },
    { heading: "Cost estimate", body: report.cost_estimate },
  ];

  for (const section of sections) {
    addHeading(section.heading);
    addBody(section.body);
  }

  if (idea.source_signals && idea.source_signals.length > 0) {
    addHeading("Inspired by");
    addBody(idea.source_signals.join("\n"));
  }

  doc.save(`${slugify(idea.title)}.pdf`);
}
