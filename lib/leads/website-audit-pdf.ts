import { jsPDF } from "jspdf";
import type { WebsiteAudit, WebsiteAuditScores } from "@/lib/types/leads";
import { LIGHTHOUSE_BENCHMARKS, DEFAULT_LIGHTHOUSE_BENCHMARK } from "@/lib/integrations/lighthouse-benchmarks";

// Plain, simple, print-friendly light document — not the app's own dark
// theme. Colors are deliberately a shade deeper than the app's vivid
// versions where used as text (readable on white), kept vivid for bar
// fills.
const TEXT_PRIMARY: [number, number, number] = [17, 24, 21];
const TEXT_SECONDARY: [number, number, number] = [71, 85, 80];
const TEXT_MUTED: [number, number, number] = [113, 128, 122];
const SURFACE: [number, number, number] = [244, 246, 245];
const SURFACE_HOVER: [number, number, number] = [236, 239, 237];
const BORDER: [number, number, number] = [222, 228, 224];
const BRAND: [number, number, number] = [5, 150, 105];
const BRAND_FILL: [number, number, number] = [16, 185, 129];
const WARNING: [number, number, number] = [180, 95, 6];
const WARNING_FILL: [number, number, number] = [245, 158, 11];
const DANGER: [number, number, number] = [200, 35, 35];
const DANGER_FILL: [number, number, number] = [239, 68, 68];

const MARGIN = 16;
const LINE_HEIGHT = 5;

const SCORE_LABELS: Record<keyof WebsiteAuditScores, string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  best_practices: "Best Practices",
};

function scoreColors(score: number | null): { text: [number, number, number]; fill: [number, number, number] } {
  if (score === null) return { text: TEXT_MUTED, fill: BORDER };
  if (score >= 90) return { text: BRAND, fill: BRAND_FILL };
  if (score >= 50) return { text: WARNING, fill: WARNING_FILL };
  return { text: DANGER, fill: DANGER_FILL };
}

// Google's own standard band names (not invented) — a bare "55" means
// nothing without this.
function scoreBand(score: number | null): string {
  if (score === null) return "";
  if (score >= 90) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}

// Standard Core Web Vitals thresholds (Google's own "good / needs
// improvement / poor" bands), not an invented scale.
function lcpColors(ms: number) {
  return ms <= 2500 ? { text: BRAND, fill: BRAND_FILL } : ms <= 4000 ? { text: WARNING, fill: WARNING_FILL } : { text: DANGER, fill: DANGER_FILL };
}
function clsColors(v: number) {
  return v <= 0.1 ? { text: BRAND, fill: BRAND_FILL } : v <= 0.25 ? { text: WARNING, fill: WARNING_FILL } : { text: DANGER, fill: DANGER_FILL };
}
function tbtColors(ms: number) {
  return ms <= 200 ? { text: BRAND, fill: BRAND_FILL } : ms <= 600 ? { text: WARNING, fill: WARNING_FILL } : { text: DANGER, fill: DANGER_FILL };
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

  // followingHeight reserves room for the heading PLUS whatever comes right
  // after it, so a heading never gets stranded alone at the bottom of a
  // page with its content pushed to the next one.
  function heading(text: string, followingHeight = 0) {
    ensureSpace(11 + followingHeight);
    doc.setFillColor(...BRAND_FILL);
    doc.rect(MARGIN, y - 3.2, 1.2, 4.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...TEXT_PRIMARY);
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
    doc.setFillColor(...(ok ? BRAND_FILL : DANGER_FILL));
    doc.circle(MARGIN + 1.3, y - 1.3, 1.3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(detail ? `${label} — ${detail}` : label, MARGIN + 5, y);
    y += LINE_HEIGHT + 1;
  }

  // One horizontal bar per row: label on the left, a track + filled bar
  // scaled to `value / max` (clamped to 1), the display value at the bar's
  // end, and an optional "good" threshold tick drawn on top of the track.
  function barRow(label: string, value: number, max: number, displayValue: string, colors: { fill: [number, number, number] }, goodThreshold?: number) {
    const rowH = 11;
    ensureSpace(rowH);
    const labelW = 40;
    const valueW = 46;
    const chartLeft = MARGIN + labelW;
    const chartWidth = contentWidth - labelW - valueW;
    const barY = y - 3.2;
    const barH = 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(fitOneLine(label, labelW - 3), MARGIN, y);

    doc.setFillColor(...SURFACE);
    doc.roundedRect(chartLeft, barY, chartWidth, barH, 1, 1, "F");

    const filledW = Math.max(chartWidth * Math.min(value / max, 1), 1.5);
    doc.setFillColor(...colors.fill);
    doc.roundedRect(chartLeft, barY, filledW, barH, 1, 1, "F");

    if (goodThreshold !== undefined) {
      const tickX = chartLeft + chartWidth * Math.min(goodThreshold / max, 1);
      doc.setDrawColor(...TEXT_MUTED);
      doc.setLineWidth(0.3);
      doc.line(tickX, barY - 0.8, tickX, barY + barH + 0.8);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(fitOneLine(displayValue, valueW - 3), chartLeft + chartWidth + 3, y);

    y += rowH;
  }

  // Pre-measures a headline + "Your Site vs Good Practice" comparison
  // table + an explanation paragraph, used for both the curated findings
  // and the full raw technical findings — same visual, different data.
  function measureComparisonBlock(headline: string, impact: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const headlineLines: string[] = doc.splitTextToSize(headline, contentWidth - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const impactLines: string[] = impact ? doc.splitTextToSize(impact, contentWidth - 6) : [];
    const tableRowH = 14;
    const blockHeight = headlineLines.length * 5.6 + 2 + tableRowH + 2 + (impactLines.length > 0 ? impactLines.length * 4.4 + 2 : 0);
    return { headlineLines, impactLines, tableRowH, blockHeight };
  }

  function drawComparisonBlock(
    headlineLines: string[],
    yourValue: string,
    goodValue: string,
    impactLines: string[],
    tableRowH: number
  ) {
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
    doc.text(fitOneLine(yourValue, colW - 8), MARGIN + 4, iy + 11);
    doc.setTextColor(...BRAND);
    doc.text(fitOneLine(goodValue, colW - 8), MARGIN + colW + 8, iy + 11);

    iy += tableRowH + 2;

    if (impactLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_SECONDARY);
      for (const line of impactLines) {
        doc.text(line, MARGIN, iy);
        iy += 4.4;
      }
    }
  }

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
  doc.text("A technical look at how your website performs for visitors and in Google search.", MARGIN, y);
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
      const imgWidth = 80;
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

  // Scores — bar chart (relative magnitude at a glance) plus the exact
  // number and Google's own band name for each.
  if (audit.scores) {
    const rowH = 11;
    const rowCount = Object.keys(SCORE_LABELS).length;
    heading("Scores (out of 100)", rowCount * rowH + 4);
    for (const [key, label] of Object.entries(SCORE_LABELS) as [keyof WebsiteAuditScores, string][]) {
      const score = audit.scores[key];
      const colors = scoreColors(score);
      barRow(label, score ?? 0, 100, score === null ? "—" : `${score} · ${scoreBand(score)}`, colors);
    }
    y += 4;
  }

  // Core Web Vitals — same bar-chart treatment, each scaled to a sensible
  // max for its own unit, with a tick mark at Google's "good" threshold so
  // the gap is visible, not just stated.
  if (audit.core_web_vitals && (audit.core_web_vitals.lcp_ms !== null || audit.core_web_vitals.cls !== null || audit.core_web_vitals.tbt_ms !== null)) {
    const { lcp_ms, cls, tbt_ms } = audit.core_web_vitals;
    const rows: { label: string; value: number; max: number; display: string; colors: { fill: [number, number, number] }; threshold: number }[] = [];
    if (lcp_ms !== null) rows.push({ label: "Largest Contentful Paint", value: lcp_ms, max: 10000, display: `${(lcp_ms / 1000).toFixed(1)}s`, colors: lcpColors(lcp_ms), threshold: 2500 });
    if (cls !== null) rows.push({ label: "Cumulative Layout Shift", value: cls, max: 0.5, display: cls.toFixed(2), colors: clsColors(cls), threshold: 0.1 });
    if (tbt_ms !== null) rows.push({ label: "Total Blocking Time", value: tbt_ms, max: 1000, display: `${Math.round(tbt_ms)}ms`, colors: tbtColors(tbt_ms), threshold: 200 });

    const rowH = 11;
    heading("Load Performance (mobile)", rows.length * rowH + 7);
    for (const r of rows) {
      barRow(r.label, r.value, r.max, r.display, r.colors, r.threshold);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("The vertical tick on each bar marks Google's own \"good\" threshold for that metric.", MARGIN, y);
    y += 8;
  }

  // Summary
  if (audit.ai_summary) {
    heading("Summary");
    paragraph(audit.ai_summary, 10, TEXT_PRIMARY);
    y += 4;
  }

  // Technical checks
  if (audit.meta || audit.cms_detected) {
    heading("Page & Technical Checklist", LINE_HEIGHT + 1);
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

  // Findings — curated, business-language translation of the most
  // important raw checks. Each is its own small comparison table ("Your
  // Site" vs "Good Practice") so the gap is visible, not just asserted.
  if (audit.findings && audit.findings.length > 0) {
    const blocks = audit.findings.map((finding) => ({ finding, ...measureComparisonBlock(finding.headline, finding.business_impact) }));

    heading("What I Found", blocks[0].blockHeight + 3);

    for (const { finding, headlineLines, impactLines, tableRowH, blockHeight } of blocks) {
      ensureSpace(blockHeight + 4);
      drawComparisonBlock(headlineLines, finding.your_value, finding.good_benchmark, impactLines, tableRowH);
      y += blockHeight + 4;
    }
  }

  // Full technical findings — the complete raw PageSpeed/Lighthouse checks
  // (not just the curated handful above), for anyone who wants the deeper
  // detail: every failing audit gets the same "Your Site vs Good Practice"
  // comparison table as the curated findings, using Google's own published
  // benchmark where one is known for that specific check (not invented).
  if (audit.issues && audit.issues.length > 0) {
    const rows = audit.issues.map((issue) => ({
      issue,
      ...measureComparisonBlock(`${issue.severity === "high" ? "High — " : "Medium — "}${issue.title}`, issue.detail),
    }));

    heading("Full Technical Findings", rows[0].blockHeight + 3);
    paragraph("Every failing Lighthouse check this analysis found, each measured against Google's own recommended practice.", 8.5, TEXT_MUTED);
    y += 2;

    for (const { issue, headlineLines, impactLines, tableRowH, blockHeight } of rows) {
      ensureSpace(blockHeight + 4);
      drawComparisonBlock(
        headlineLines,
        issue.value ?? "Fails this check",
        LIGHTHOUSE_BENCHMARKS[issue.id] ?? DEFAULT_LIGHTHOUSE_BENCHMARK,
        impactLines,
        tableRowH
      );
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

/** Opens the PDF in a new tab for viewing — no file gets saved to disk. */
export function previewWebsiteAuditPdf(params: { businessName: string; audit: WebsiteAudit; screenshotDataUrl?: string | null }) {
  renderWebsiteAuditPdf(params).output("dataurlnewwindow");
}

/** Fetches a (likely signed, short-lived) URL and converts it to a data URL — needed to embed the screenshot in a client-rendered PDF. */
export async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
