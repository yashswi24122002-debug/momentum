"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { fetcher } from "@/lib/swr-fetcher";
import { downloadWebsiteAuditPdf, websiteAuditPdfBlob, toDataUrl } from "@/lib/leads/website-audit-pdf";
import { LIGHTHOUSE_BENCHMARKS, DEFAULT_LIGHTHOUSE_BENCHMARK } from "@/lib/integrations/lighthouse-benchmarks";
import type { BusinessLead, WebsiteAudit, WebsiteAuditScores } from "@/lib/types/leads";

const DOCUMENTS_BUCKET = "documents";

function ComparisonCard({ headline, yourValue, goodValue, impact }: { headline: string; yourValue: string; goodValue: string; impact?: string }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-background p-3">
      <p className="text-sm font-medium text-text-primary">{headline}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-surface-hover px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Your Site</p>
          <p className="text-sm font-semibold text-danger">{yourValue}</p>
        </div>
        <div className="rounded-md bg-surface-hover px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Good Practice</p>
          <p className="text-sm font-semibold text-primary">{goodValue}</p>
        </div>
      </div>
      {impact && <p className="text-xs text-text-secondary">{impact}</p>}
    </div>
  );
}

const SCORE_LABELS: Record<keyof WebsiteAuditScores, string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  best_practices: "Best Practices",
};

function scoreClass(score: number | null): string {
  if (score === null) return "text-text-muted";
  if (score >= 90) return "text-primary";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

export function WebsiteAuditDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: BusinessLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { data, mutate } = useSWR<{ audit: WebsiteAudit | null; screenshotUrl: string | null }>(
    open ? `/api/leads/${lead.id}/website-audit` : null,
    fetcher
  );

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze-website`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't analyze that site — try again." }));
        toast.error(error);
        return;
      }
      await mutate();
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function downloadReport(audit: WebsiteAudit, screenshotUrl: string | null) {
    setDownloading(true);
    try {
      const screenshotDataUrl = screenshotUrl ? await toDataUrl(screenshotUrl).catch(() => null) : null;
      downloadWebsiteAuditPdf({ businessName: lead.name, audit, screenshotDataUrl });

      // Also upload + record the path so the outreach email can attach it.
      const blob = websiteAuditPdfBlob({ businessName: lead.name, audit, screenshotDataUrl });
      const path = `${crypto.randomUUID()}.pdf`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, blob, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      const res = await fetch(`/api/leads/${lead.id}/website-audit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: audit.id, report_pdf_path: path }),
      });
      if (!res.ok) throw new Error("save failed");
      await mutate();
      toast.success("Downloaded — it'll also attach automatically when you send this lead's outreach email.");
    } catch {
      toast.error("Downloaded, but couldn't prepare it for email attachment — try again.");
    } finally {
      setDownloading(false);
    }
  }

  const audit = data?.audit ?? null;
  const screenshotUrl = data?.screenshotUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Website Audit — {lead.name}</DialogTitle>
        </DialogHeader>

        {data === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !audit ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-text-secondary">No analysis yet for {lead.existing_website}.</p>
            <Button onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : null}
              {analyzing ? "Analyzing… this can take up to a minute" : "Run Analysis"}
            </Button>
          </div>
        ) : audit.status === "failed" ? (
          <div className="space-y-3 py-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm text-danger">
              <AlertTriangle className="size-4" /> Couldn&apos;t analyze this site
            </p>
            <p className="text-xs text-text-muted">{audit.error}</p>
            <Button onClick={runAnalysis} disabled={analyzing} variant="outline">
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {audit.error && (
              <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Some checks couldn&apos;t complete: {audit.error}
              </p>
            )}

            {screenshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived storage URL isn't worth next/image's remote-pattern config for one thumbnail
              <img src={screenshotUrl} alt="Website screenshot" className="max-h-48 rounded-lg border border-border object-contain" />
            )}

            {audit.scores && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.entries(SCORE_LABELS) as [keyof WebsiteAuditScores, string][]).map(([key, label]) => (
                  <div key={key} className="rounded-lg bg-background px-3 py-2 text-center">
                    <p className={`text-xl font-semibold ${scoreClass(audit.scores![key])}`}>{audit.scores![key] ?? "—"}</p>
                    <p className="text-xs text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {audit.ai_summary && <p className="text-sm text-text-secondary">{audit.ai_summary}</p>}

            {audit.meta && (
              <div className="grid grid-cols-2 gap-1.5 text-xs text-text-muted sm:grid-cols-3">
                <span>Works well on phones: {audit.meta.has_viewport ? "✓" : "✗"}</span>
                <span>Secure connection: {audit.meta.https_valid ? "✓" : "✗"}</span>
                <span>Sitemap for Google: {audit.meta.has_sitemap ? "✓" : "✗"}</span>
                <span>robots.txt: {audit.meta.has_robots ? "✓" : "✗"}</span>
                {audit.cms_detected && <span>Built on: {audit.cms_detected}</span>}
              </div>
            )}

            {audit.findings && audit.findings.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-text-muted">What I Found</p>
                {audit.findings.map((finding, i) => (
                  <ComparisonCard
                    key={i}
                    headline={finding.headline}
                    yourValue={finding.your_value}
                    goodValue={finding.good_benchmark}
                    impact={finding.business_impact}
                  />
                ))}
              </div>
            )}

            {audit.issues && audit.issues.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-text-muted">Full Technical Findings</p>
                {audit.issues.map((issue, i) => (
                  <ComparisonCard
                    key={i}
                    headline={`${issue.severity === "high" ? "High" : "Medium"} — ${issue.title}`}
                    yourValue={issue.value ?? "Fails this check"}
                    goodValue={LIGHTHOUSE_BENCHMARKS[issue.id] ?? DEFAULT_LIGHTHOUSE_BENCHMARK}
                    impact={issue.detail}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => downloadReport(audit, screenshotUrl)} disabled={downloading}>
                {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Download Report (PDF)
              </Button>
              <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analyzing}>
                {analyzing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
