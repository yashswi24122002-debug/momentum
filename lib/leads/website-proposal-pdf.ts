import { jsPDF } from "jspdf";
import type { LeadWebsiteProposal } from "@/lib/types/leads";

// Same light palette as website-audit-pdf.ts, kept as its own copy rather
// than a shared import — same precedent as lib/jobs/resume-pdf.ts and
// cover-letter-pdf.ts each being fully self-contained.
const TEXT_PRIMARY: [number, number, number] = [17, 24, 21];
const TEXT_SECONDARY: [number, number, number] = [71, 85, 80];
const TEXT_MUTED: [number, number, number] = [113, 128, 122];
const SURFACE: [number, number, number] = [244, 246, 245];
const BRAND_FILL: [number, number, number] = [16, 185, 129];

const MARGIN = 16;
const LINE_HEIGHT = 5;

// Standard offering — fixed/mechanical, not AI-generated, since these are
// real service details rather than something that needs per-lead variation.
const STANDARD_FEATURES = [
  "Mobile-responsive design that works well on phones, tablets, and desktops",
  "Fast loading speed, optimized from the start",
  "SEO-friendly structure so the site is findable on Google",
  "A contact form so visitors can reach you directly",
  "Google Maps and click-to-call integration",
  "Links to your social media profiles",
];

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "website-proposal"
  );
}

export function renderWebsiteProposalPdf(params: {
  businessName: string;
  category: string | null;
  area: string | null;
  proposal: LeadWebsiteProposal;
}): jsPDF {
  const { businessName, category, area, proposal } = params;
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

  function checkRow(label: string) {
    ensureSpace(LINE_HEIGHT + 1);
    doc.setFillColor(...BRAND_FILL);
    doc.circle(MARGIN + 1.3, y - 1.3, 1.3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_SECONDARY);
    const lines: string[] = doc.splitTextToSize(label, contentWidth - 5);
    doc.text(lines, MARGIN + 5, y);
    y += LINE_HEIGHT * lines.length + 1;
  }

  function pageCard(label: string, x: number, w: number) {
    const h = 12;
    doc.setFillColor(...SURFACE);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_PRIMARY);
    const lines: string[] = doc.splitTextToSize(label, w - 6);
    doc.text(lines[0] ?? label, x + w / 2, y + h / 2 + 1.2, { align: "center" });
    return h;
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(`Website Proposal — ${businessName}`, MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    [category, area].filter(Boolean).join(" · ") + `   ·   ${new Date(proposal.created_at).toLocaleDateString()}`,
    MARGIN,
    y
  );
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text("A short case for a website, and what it could include.", MARGIN, y);
  y += 10;

  if (proposal.why) {
    heading("Why a Website");
    paragraph(proposal.why, 10, TEXT_PRIMARY);
    y += 4;
  }

  if (proposal.suggested_pages && proposal.suggested_pages.length > 0) {
    const cols = 3;
    const gap = 3;
    const cardW = (contentWidth - gap * (cols - 1)) / cols;
    const rows = Math.ceil(proposal.suggested_pages.length / cols);
    heading("Suggested Website Structure", rows * 15);
    let cx = MARGIN;
    let col = 0;
    for (const page of proposal.suggested_pages) {
      const h = pageCard(page, cx, cardW);
      col++;
      if (col >= cols) {
        col = 0;
        cx = MARGIN;
        y += h + gap;
      } else {
        cx += cardW + gap;
      }
    }
    if (col !== 0) y += 15;
    y += 6;
  }

  heading("What's Included", LINE_HEIGHT + 1);
  for (const feature of STANDARD_FEATURES) checkRow(feature);
  y += 4;

  paragraph(
    "This is an indicative starting point — the final structure and features are tailored to your specific business once I understand your requirements in more detail.",
    8.5,
    TEXT_MUTED
  );

  return doc;
}

export function websiteProposalPdfBlob(params: {
  businessName: string;
  category: string | null;
  area: string | null;
  proposal: LeadWebsiteProposal;
}): Blob {
  return renderWebsiteProposalPdf(params).output("blob");
}

export function downloadWebsiteProposalPdf(params: {
  businessName: string;
  category: string | null;
  area: string | null;
  proposal: LeadWebsiteProposal;
}) {
  renderWebsiteProposalPdf(params).save(`${slugify(params.businessName)}-website-proposal.pdf`);
}

/** Opens the PDF in a new tab for viewing — no file gets saved to disk. */
export function previewWebsiteProposalPdf(params: {
  businessName: string;
  category: string | null;
  area: string | null;
  proposal: LeadWebsiteProposal;
}) {
  renderWebsiteProposalPdf(params).output("dataurlnewwindow");
}
