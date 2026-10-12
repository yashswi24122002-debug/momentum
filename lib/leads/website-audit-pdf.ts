import { jsPDF } from "jspdf";
import type { WebsiteAudit, WebsiteAuditScores } from "@/lib/types/leads";

// Same palette as the app's own dark theme (app/globals.css) — the report
// is meant to look like it came from this product, not a generic jsPDF
// default white page.
const BG: [number, number, number] = [10, 14, 13];
const SURFACE: [number, number, number] = [18, 23, 22];
const SURFACE_HOVER: [number, number, number] = [26, 33, 31];
const BORDER: [number, number, number] = [35, 43, 41];
const TEXT_PRIMARY: [number, number, number] = [243, 245, 244];
const TEXT_SECONDARY: [number, number, number] = [156, 168, 165];
const TEXT_MUTED: [number, number, number] = [107, 118, 116];
const BRAND: [number, number, number] = [16, 185, 129];
const WARNING: [number, number, number] = [245, 158, 11];
const DANGER: [number, number, number] = [239, 68, 68];

const MARGIN = 16;
const LINE_HEIGHT = 5;

const SCORE_LABELS: Record<keyof WebsiteAuditScores, string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  best_practices: "Best Practices",
};

function scoreColor(score: number | null): [number, number, number] {
  if (score === null) return TEXT_MUTED;
  if (score >= 90) return BRAND;
  if (score >= 50) return WARNING;
  return DANGER;
}

// Standard Core Web Vitals thresholds (Google's own "good / needs
// improvement / poor" bands), not an invented scale.
function lcpColor(ms: number): [number, number, number] {
  return ms <= 2500 ? BRAND : ms <= 4000 ? WARNING : DANGER;
}
function clsColor(v: number): [number, number, number] {
  return v <= 0.1 ? BRAND : v <= 0.25 ? WARNING : DANGER;
}
function tbtColor(ms: number): [number, number, number] {
  return ms <= 200 ? BRAND : ms <= 600 ? WARNING : DANGER;
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

  function paintBackground() {
    doc.setFillColor(...BG);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }

  function ensureSpace(h: number) {
    if (y + h > pageHeight - MARGIN) {
      doc.addPage();
      paintBackground();
      y = MARGIN;
    }
  }

  // followingHeight reserves room for the heading PLUS whatever comes right
  // after it, so a heading never gets stranded alone at the bottom of a
  // page with its content pushed to the next one.
  function heading(text: string, color: [number, number, number] = TEXT_PRIMARY, followingHeight = 0) {
    ensureSpace(11 + followingHeight);
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, y - 3.2, 1.2, 4.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...color);
    doc.text(text, MARGIN + 4, y);
    y += 7;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = TEXT_SECONDARY) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  function checkRow(label: string, ok: boolean, detail?: string) {
    ensureSpace(LINE_HEIGHT + 1);
    doc.setFillColor(...(ok ? BRAND : DANGER));
    doc.circle(MARGIN + 1.3, y - 1.3, 1.3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(detail ? `${label} — ${detail}` : label, MARGIN + 5, y);
    y += LINE_HEIGHT + 1;
  }

  paintBackground();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(`Website Audit — ${businessName}`, MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${audit.url}   ·   ${new Date(audit.requested_at).toLocaleDateString()}`, MARGIN, y);
  y += 9;

  // Partial-failure note — a check that didn't complete shouldn't just be
  // silently missing from the report with no explanation.
  if (audit.error) {
    const lines: string[] = doc.splitTextToSize(`Some checks couldn't complete: ${audit.error}`, contentWidth - 8);
    const boxHeight = lines.length * 4.6 + 5;
    ensureSpace(boxHeight + 4);
    doc.setFillColor(...SURFACE_HOVER);
    doc.roundedRect(MARGIN, y, contentWidth, boxHeight, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...WARNING);
    let noteY = y + 5;
    for (const line of lines) {
      doc.text(line, MARGIN + 4, noteY);
      noteY += 4.6;
    }
    y += boxHeight + 7;
  }

  // Screenshot
  if (screenshotDataUrl) {
    try {
      const imgWidth = 90;
      const imgHeight = imgWidth * 1.8;
      ensureSpace(imgHeight + 6);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.4);
      doc.roundedRect(MARGIN, y, imgWidth, imgHeight, 2, 2, "S");
      doc.addImage(screenshotDataUrl, "JPEG", MARGIN + 0.6, y + 0.6, imgWidth - 1.2, imgHeight - 1.2, undefined, "FAST");
      y += imgHeight + 8;
    } catch {
      // A malformed data URL shouldn't block the rest of the report.
    }
  }

  // Scores
  if (audit.scores) {
    const tileW = (contentWidth - 9) / 4;
    const tileH = 20;
    heading("Scores (out of 100)", undefined, tileH + 6);
    let tx = MARGIN;
    for (const [key, label] of Object.entries(SCORE_LABELS) as [keyof WebsiteAuditScores, string][]) {
      const score = audit.scores[key];
      doc.setFillColor(...SURFACE);
      doc.roundedRect(tx, y, tileW, tileH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...scoreColor(score));
      doc.text(score === null ? "—" : String(score), tx + tileW / 2, y + 9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(label, tx + tileW / 2, y + 15, { align: "center" });
      tx += tileW + 3;
    }
    y += tileH + 9;
  }

  // Core Web Vitals
  if (audit.core_web_vitals && (audit.core_web_vitals.lcp_ms !== null || audit.core_web_vitals.cls !== null || audit.core_web_vitals.tbt_ms !== null)) {
    const { lcp_ms, cls, tbt_ms } = audit.core_web_vitals;
    const vitals: { label: string; value: string; color: [number, number, number] }[] = [];
    if (lcp_ms !== null) vitals.push({ label: "Largest Contentful Paint", value: `${(lcp_ms / 1000).toFixed(1)}s`, color: lcpColor(lcp_ms) });
    if (cls !== null) vitals.push({ label: "Cumulative Layout Shift", value: cls.toFixed(2), color: clsColor(cls) });
    if (tbt_ms !== null) vitals.push({ label: "Total Blocking Time", value: `${Math.round(tbt_ms)}ms`, color: tbtColor(tbt_ms) });

    const tileW = (contentWidth - (vitals.length - 1) * 3) / vitals.length;
    const tileH = 18;
    heading("Load performance (mobile)", undefined, tileH + 6);
    let tx = MARGIN;
    for (const v of vitals) {
      doc.setFillColor(...SURFACE);
      doc.roundedRect(tx, y, tileW, tileH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...v.color);
      doc.text(v.value, tx + tileW / 2, y + 8, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(v.label, tx + tileW / 2, y + 14, { align: "center", maxWidth: tileW - 4 });
      tx += tileW + 3;
    }
    y += tileH + 9;
  }

  // Summary
  if (audit.ai_summary) {
    heading("Summary");
    paragraph(audit.ai_summary, 10, TEXT_PRIMARY);
    y += 4;
  }

  // Technical checks
  if (audit.meta || audit.cms_detected) {
    heading("Page & technical checks", undefined, LINE_HEIGHT + 1);
    if (audit.meta) {
      checkRow("Title tag", Boolean(audit.meta.title), audit.meta.title ? `"${audit.meta.title}"` : "missing");
      checkRow("Meta description", audit.meta.description !== null);
      checkRow("Mobile viewport tag", audit.meta.has_viewport);
      checkRow("HTTPS", audit.meta.https_valid);
      checkRow("robots.txt", audit.meta.has_robots);
      checkRow("sitemap.xml", audit.meta.has_sitemap);
    }
    if (audit.cms_detected) checkRow("Built on", true, audit.cms_detected);
    y += 4;
  }

  // Issues
  if (audit.issues && audit.issues.length > 0) {
    const issueBlocks = audit.issues.map((issue) => {
      const titleText = `${issue.severity === "high" ? "High priority — " : "Medium priority — "}${issue.title}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const titleLines: string[] = doc.splitTextToSize(titleText, contentWidth - 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const detailLines: string[] = issue.detail ? doc.splitTextToSize(issue.detail, contentWidth - 6) : [];
      const blockHeight = titleLines.length * 5.2 + detailLines.length * 4.4 + 4;
      return { issue, titleLines, detailLines, blockHeight };
    });

    heading("Issues found", undefined, issueBlocks[0].blockHeight + 3);

    for (const { issue, titleLines, detailLines, blockHeight } of issueBlocks) {
      ensureSpace(blockHeight + 3);

      doc.setFillColor(...(issue.severity === "high" ? DANGER : WARNING));
      doc.rect(MARGIN, y - 1, 1.2, blockHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_PRIMARY);
      let iy = y + 3;
      for (const line of titleLines) {
        doc.text(line, MARGIN + 4, iy);
        iy += 5.2;
      }
      if (detailLines.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MUTED);
        for (const line of detailLines) {
          doc.text(line, MARGIN + 4, iy);
          iy += 4.4;
        }
      }
      y += blockHeight + 3;
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
