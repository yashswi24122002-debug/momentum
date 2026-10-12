import { jsPDF } from "jspdf";
import type { WebsiteAudit } from "@/lib/types/leads";

const MARGIN = 20;
const LINE_HEIGHT = 5.4;

const SCORE_LABELS: Record<keyof NonNullable<WebsiteAudit["scores"]>, string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  best_practices: "Best Practices",
};

function scoreColor(score: number | null): [number, number, number] {
  if (score === null) return [90, 98, 96];
  if (score >= 90) return [16, 150, 90];
  if (score >= 50) return [180, 130, 20];
  return [200, 50, 50];
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "website-audit"
  );
}

export function renderWebsiteAuditPdf(params: {
  businessName: string;
  audit: WebsiteAudit;
  screenshotDataUrl?: string | null;
}): jsPDF {
  const { businessName, audit, screenshotDataUrl } = params;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  function ensureSpace(h: number) {
    if (y + h > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(16, 24, 22);
    doc.text(text, MARGIN, y);
    y += 7;
  }

  function paragraph(text: string, size = 10) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(35, 42, 40);
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(16, 24, 22);
  doc.text(`Website Audit — ${businessName}`, MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 98, 96);
  doc.text(`${audit.url}  ·  ${new Date(audit.requested_at).toLocaleDateString()}`, MARGIN, y);
  y += 10;

  if (screenshotDataUrl) {
    try {
      const imgWidth = 70;
      const imgHeight = imgWidth * 1.8; // rough mobile-screenshot aspect ratio
      ensureSpace(imgHeight + 4);
      doc.addImage(screenshotDataUrl, "JPEG", MARGIN, y, imgWidth, imgHeight, undefined, "FAST");
      y += imgHeight + 6;
    } catch {
      // A malformed data URL shouldn't block the rest of the report.
    }
  }

  if (audit.ai_summary) {
    heading("Summary");
    paragraph(audit.ai_summary);
    y += 4;
  }

  if (audit.scores) {
    heading("Scores (out of 100)");
    for (const [key, label] of Object.entries(SCORE_LABELS) as [keyof typeof SCORE_LABELS, string][]) {
      const score = audit.scores[key];
      ensureSpace(LINE_HEIGHT);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(35, 42, 40);
      doc.text(label, MARGIN, y);
      doc.setFont("helvetica", "bold");
      const color = scoreColor(score);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(score === null ? "—" : String(score), MARGIN + 50, y);
      y += LINE_HEIGHT;
    }
    y += 4;
  }

  if (audit.core_web_vitals) {
    heading("Load performance");
    const { lcp_ms, cls, tbt_ms } = audit.core_web_vitals;
    paragraph(
      [
        lcp_ms !== null ? `Largest Contentful Paint: ${(lcp_ms / 1000).toFixed(1)}s` : null,
        cls !== null ? `Cumulative Layout Shift: ${cls.toFixed(2)}` : null,
        tbt_ms !== null ? `Total Blocking Time: ${Math.round(tbt_ms)}ms` : null,
      ]
        .filter(Boolean)
        .join("   ·   ")
    );
    y += 4;
  }

  if (audit.meta) {
    heading("Page & technical checks");
    const checks = [
      `Title tag: ${audit.meta.title ? `"${audit.meta.title}"` : "missing"}`,
      `Meta description: ${audit.meta.description ? "present" : "missing"}`,
      `Mobile viewport tag: ${audit.meta.has_viewport ? "present" : "missing"}`,
      `HTTPS: ${audit.meta.https_valid ? "valid" : "not valid"}`,
      `robots.txt: ${audit.meta.has_robots ? "found" : "not found"}`,
      `sitemap.xml: ${audit.meta.has_sitemap ? "found" : "not found"}`,
      audit.cms_detected ? `Built on: ${audit.cms_detected}` : null,
    ].filter(Boolean) as string[];
    for (const c of checks) paragraph(`•  ${c}`);
    y += 4;
  }

  if (audit.issues && audit.issues.length > 0) {
    heading("Issues found");
    for (const issue of audit.issues) {
      ensureSpace(LINE_HEIGHT * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(35, 42, 40);
      const sevLines: string[] = doc.splitTextToSize(`${issue.severity === "high" ? "[High] " : "[Medium] "}${issue.title}`, contentWidth);
      for (const line of sevLines) {
        ensureSpace(LINE_HEIGHT);
        doc.text(line, MARGIN, y);
        y += LINE_HEIGHT;
      }
      if (issue.detail) paragraph(issue.detail, 9);
      y += 2;
    }
  }

  return doc;
}

export function websiteAuditPdfBlob(params: { businessName: string; audit: WebsiteAudit; screenshotDataUrl?: string | null }): Blob {
  return renderWebsiteAuditPdf(params).output("blob");
}

export function downloadWebsiteAuditPdf(params: { businessName: string; audit: WebsiteAudit; screenshotDataUrl?: string | null }) {
  renderWebsiteAuditPdf(params).save(`${slugify(params.businessName)}-website-audit.pdf`);
}
