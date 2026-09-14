import { jsPDF } from "jspdf";

const MARGIN = 20;
const LINE_HEIGHT = 5.4;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "cover-letter"
  );
}

export function renderCoverLetterPdf(params: { applicantName: string; company: string; roleTitle: string; bodyText: string }): jsPDF {
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(16, 24, 22);
  doc.text(params.applicantName, MARGIN, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 98, 96);
  doc.text(`Re: ${params.roleTitle} at ${params.company}`, MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(35, 42, 40);
  const paragraphs = params.bodyText.split(/\n{2,}/);
  for (const para of paragraphs) {
    const lines: string[] = doc.splitTextToSize(para.trim(), contentWidth);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += 3;
  }

  return doc;
}

export function downloadCoverLetterPdf(params: { applicantName: string; company: string; roleTitle: string; bodyText: string }) {
  renderCoverLetterPdf(params).save(`${slugify(params.company)}-cover-letter.pdf`);
}

export function coverLetterPdfBlob(params: { applicantName: string; company: string; roleTitle: string; bodyText: string }): Blob {
  return renderCoverLetterPdf(params).output("blob");
}
