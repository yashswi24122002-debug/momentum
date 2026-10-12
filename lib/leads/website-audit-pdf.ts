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

// Google's own standard band names (not invented) — a bare "55" means
// nothing to a non-technical reader without this.
function scoreBand(score: number | null): string {
  if (score === null) return "";
  if (score >= 90) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
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

  function fitOneLine(text: string, maxWidth: number): string {
    const lines: string[] = doc.splitTextToSize(text, maxWidth);
    if (lines.length <= 1) return lines[0] ?? text;
    return `${lines[0].replace(/\s+\S*$/, "")}…`;
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
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text("A plain-English look at how your website performs for visitors and in Google search.", MARGIN, y);
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
    const tileH = 24;
    heading("Your Site At a Glance", undefined, tileH + 6);
    let tx = MARGIN;
    for (const [key, label] of Object.entries(SCORE_LABELS) as [keyof WebsiteAuditScores, string][]) {
      const score = audit.scores[key];
      const color = scoreColor(score);
      doc.setFillColor(...SURFACE);
      doc.roundedRect(tx, y, tileW, tileH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...color);
      doc.text(score === null ? "—" : String(score), tx + tileW / 2, y + 9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(label, tx + tileW / 2, y + 15, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...color);
      doc.text(scoreBand(score), tx + tileW / 2, y + 20, { align: "center" });
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
    heading("Page & Technical Checklist", undefined, LINE_HEIGHT + 1);
    if (audit.meta) {
      checkRow("Page title", Boolean(audit.meta.title), audit.meta.title ? `"${audit.meta.title}"` : "missing — hurts how you appear in search results");
      checkRow("Search description", audit.meta.description !== null, audit.meta.description !== null ? undefined : "missing — Google shows a random snippet instead");
      checkRow("Works well on phones", audit.meta.has_viewport, audit.meta.has_viewport ? undefined : "not set up — most visitors are on mobile");
      checkRow("Secure connection (HTTPS)", audit.meta.https_valid, audit.meta.https_valid ? "keeps visitor data secure" : "not secure — browsers may warn visitors");
      checkRow("robots.txt", audit.meta.has_robots);
      checkRow("Sitemap for Google", audit.meta.has_sitemap, audit.meta.has_sitemap ? undefined : "missing — can make new pages slower to get found");
    }
    if (audit.cms_detected) checkRow("Built on", true, audit.cms_detected);
    y += 4;
  }

  // Findings — the curated, business-language translation of the raw
  // PageSpeed/Lighthouse checks (lib/ai synthesizes these; the raw jargon
  // never reaches this report). Each is its own small comparison table
  // ("Your Site" vs "Good Practice") rather than one long list, so the gap
  // is immediately visible, not just asserted in prose.
  if (audit.findings && audit.findings.length > 0) {
    const blocks = audit.findings.map((finding) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      const headlineLines: string[] = doc.splitTextToSize(finding.headline, contentWidth - 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const impactLines: string[] = doc.splitTextToSize(finding.business_impact, contentWidth - 6);
      const tableRowH = 14;
      const blockHeight = headlineLines.length * 5.6 + 2 + tableRowH + 2 + impactLines.length * 4.4 + 5;
      return { finding, headlineLines, impactLines, tableRowH, blockHeight };
    });

    heading("What We Found", undefined, blocks[0].blockHeight + 3);

    for (const { finding, headlineLines, impactLines, tableRowH, blockHeight } of blocks) {
      ensureSpace(blockHeight + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXT_PRIMARY);
      let iy = y;
      for (const line of headlineLines) {
        doc.text(line, MARGIN, iy);
        iy += 5.6;
      }
      iy += 2;

      const colW = (contentWidth - 4) / 2;
      doc.setFillColor(...SURFACE);
      doc.roundedRect(MARGIN, iy, colW, tableRowH, 1.5, 1.5, "F");
      doc.roundedRect(MARGIN + colW + 4, iy, colW, tableRowH, 1.5, 1.5, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text("YOUR SITE", MARGIN + 4, iy + 5);
      doc.text("GOOD PRACTICE", MARGIN + colW + 8, iy + 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...DANGER);
      doc.text(fitOneLine(finding.your_value, colW - 8), MARGIN + 4, iy + 11);
      doc.setTextColor(...BRAND);
      doc.text(fitOneLine(finding.good_benchmark, colW - 8), MARGIN + colW + 8, iy + 11);

      iy += tableRowH + 2;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_SECONDARY);
      for (const line of impactLines) {
        doc.text(line, MARGIN, iy);
        iy += 4.4;
      }

      y += blockHeight + 4;
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
