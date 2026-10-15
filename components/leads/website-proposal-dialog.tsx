"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { fetcher } from "@/lib/swr-fetcher";
import { downloadWebsiteProposalPdf, websiteProposalPdfBlob } from "@/lib/leads/website-proposal-pdf";
import type { BusinessLead, LeadWebsiteProposal } from "@/lib/types/leads";

const DOCUMENTS_BUCKET = "documents";

export function WebsiteProposalDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: BusinessLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { data, mutate } = useSWR<{ proposal: LeadWebsiteProposal | null }>(
    open ? `/api/leads/${lead.id}/website-proposal` : null,
    fetcher
  );

  async function draft() {
    setDrafting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-proposal`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't draft that — try again." }));
        toast.error(error);
        return;
      }
      await mutate();
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function downloadProposal(proposal: LeadWebsiteProposal) {
    setDownloading(true);
    try {
      downloadWebsiteProposalPdf({ businessName: lead.name, category: lead.category, area: lead.area, proposal });

      // Also upload + record the path so the outreach email can attach it.
      const blob = websiteProposalPdfBlob({ businessName: lead.name, category: lead.category, area: lead.area, proposal });
      const path = `${crypto.randomUUID()}.pdf`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, blob, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      const res = await fetch(`/api/leads/${lead.id}/website-proposal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id, pdf_path: path }),
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

  const proposal = data?.proposal ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Website Proposal — {lead.name}</DialogTitle>
        </DialogHeader>

        {data === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : !proposal ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-text-secondary">No proposal drafted yet for {lead.name}.</p>
            <Button onClick={draft} disabled={drafting}>
              {drafting ? <Loader2 className="size-4 animate-spin" /> : null}
              {drafting ? "Drafting…" : "Draft Proposal"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {proposal.why && <p className="text-sm text-text-secondary">{proposal.why}</p>}

            {proposal.suggested_pages && proposal.suggested_pages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-muted">Suggested Website Structure</p>
                <div className="flex flex-wrap gap-1.5">
                  {proposal.suggested_pages.map((page, i) => (
                    <span key={i} className="rounded-md bg-background px-2.5 py-1 text-xs font-medium text-text-primary">
                      {page}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => downloadProposal(proposal)} disabled={downloading}>
                {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Download Proposal (PDF)
              </Button>
              <Button size="sm" variant="outline" onClick={draft} disabled={drafting}>
                {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Re-draft
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
