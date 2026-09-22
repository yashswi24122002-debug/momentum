"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search, Loader2, ExternalLink, Trash2, Sparkles, MapPin, Send, Kanban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { fetcher } from "@/lib/swr-fetcher";
import { LEAD_AREA_ORDER, LEAD_AREA_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from "@/lib/leads/ui";
import type { BusinessLead, LeadArea } from "@/lib/types/leads";

export function LeadList() {
  const [area, setArea] = useState<LeadArea>("noida");
  const [customArea, setCustomArea] = useState("");
  const [category, setCategory] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, mutate } = useSWR<{ leads: BusinessLead[] }>(
    `/api/leads${noWebsiteOnly ? "?has_website=false" : ""}`,
    fetcher
  );
  const leads = data?.leads ?? null;

  async function findLeads() {
    if (area === "other" && !customArea.trim()) {
      toast.error("Enter the area name.");
      return;
    }
    setDiscovering(true);
    try {
      const res = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, area_label: customArea || null, category: category || null }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't find leads — try again." }));
        toast.error(error);
        return;
      }
      const { fetched, inserted } = await res.json();
      mutate();
      toast.success(`Found ${fetched} businesses — ${inserted} new lead${inserted === 1 ? "" : "s"} added.`);
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDiscovering(false);
    }
  }

  async function saveEmail(lead: BusinessLead) {
    const email = emailDrafts[lead.id]?.trim();
    if (!email || email === lead.email) return;
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that email — try again.");
      return;
    }
    mutate((prev) => prev && { leads: prev.leads.map((l) => (l.id === lead.id ? { ...l, email } : l)) }, { revalidate: false });
    toast.success("Email saved.");
  }

  async function draftPitch(lead: BusinessLead) {
    setDrafting(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-pitch`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't draft that — try again." }));
        toast.error(error);
        return;
      }
      toast.success("Drafted — review it in the Outreach Queue.");
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDrafting(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete that — try again.");
        return;
      }
      mutate((prev) => prev && { leads: prev.leads.filter((l) => l.id !== deleteTarget.id) }, { revalidate: false });
      setDeleteTarget(null);
      toast.success("Deleted.");
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Local Leads</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/local-leads/outreach-queue" />} nativeButton={false}>
            <Send className="size-3.5" />
            Outreach Queue
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/local-leads/pipeline" />} nativeButton={false}>
            <Kanban className="size-3.5" />
            Pipeline
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3 border-border bg-surface p-4">
        <div className="space-y-1.5">
          <Label>Area</Label>
          <Select value={area} onValueChange={(v) => v && setArea(v as LeadArea)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_AREA_ORDER.map((a) => (
                <SelectItem key={a} value={a}>
                  {LEAD_AREA_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {area === "other" && (
          <div className="space-y-1.5">
            <Label>Area name</Label>
            <Input value={customArea} onChange={(e) => setCustomArea(e.target.value)} placeholder="e.g. Faridabad" />
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <Label>Category (optional)</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. restaurants, salons, gyms" />
        </div>
        <Button onClick={findLeads} disabled={discovering}>
          {discovering ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {discovering ? "Searching…" : "Find Leads"}
        </Button>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant={noWebsiteOnly ? "default" : "outline"} size="sm" onClick={() => setNoWebsiteOnly((v) => !v)}>
          No website only
        </Button>
      </div>

      {leads === null ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState icon={MapPin} title="No leads yet" description="Search an area above to find local businesses." />
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card key={lead.id} className="gap-2 border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{lead.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {[lead.category, lead.area && LEAD_AREA_LABELS[lead.area], lead.google_rating ? `★ ${lead.google_rating}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {lead.address && <p className="truncate text-xs text-text-muted">{lead.address}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {lead.existing_website ? (
                    <a
                      href={lead.existing_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-primary"
                    >
                      Website <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <StatusBadge label="No website" tone="warning" />
                  )}
                  <StatusBadge label={LEAD_STATUS_LABELS[lead.status]} tone={LEAD_STATUS_TONES[lead.status]} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={emailDrafts[lead.id] ?? lead.email ?? ""}
                  onChange={(e) => setEmailDrafts((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                  onBlur={() => saveEmail(lead)}
                  placeholder="Add an email to enable pitching"
                  className="max-w-64"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => draftPitch(lead)}
                  disabled={!lead.email || drafting === lead.id}
                >
                  {drafting === lead.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {drafting === lead.id ? "Drafting…" : "Draft Pitch"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto text-text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => setDeleteTarget(lead)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This also deletes any outreach drafted for this lead. This can't be undone."
      />
    </div>
  );
}
