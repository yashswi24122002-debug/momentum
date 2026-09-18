"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Send, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { fetcher } from "@/lib/swr-fetcher";
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_TONES } from "@/lib/leads/ui";
import type { LeadOutreachWithLead } from "@/lib/types/leads";

function OutreachCard({
  outreach,
  onSaved,
  onSent,
}: {
  outreach: LeadOutreachWithLead;
  onSaved: (updated: LeadOutreachWithLead) => void;
  onSent: (updated: LeadOutreachWithLead) => void;
}) {
  const [subject, setSubject] = useState(outreach.pitch_subject ?? "");
  const [bodyText, setBodyText] = useState(outreach.pitch_body_final ?? outreach.pitch_body_draft ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const editable = outreach.status === "draft" || outreach.status === "approved";
  const dirty = subject !== (outreach.pitch_subject ?? "") || bodyText !== (outreach.pitch_body_final ?? outreach.pitch_body_draft ?? "");

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/lead-outreach/${outreach.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitch_subject: subject, pitch_body_final: bodyText }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save — try again.");
      return;
    }
    const { outreach: updated } = await res.json();
    onSaved({ ...outreach, ...updated });
    toast.success("Saved.");
  }

  async function send() {
    if (dirty) await save();
    setSending(true);
    const res = await fetch(`/api/lead-outreach/${outreach.id}/send`, { method: "POST" });
    setSending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't send — try again." }));
      toast.error(error);
      return;
    }
    const { outreach: updated } = await res.json();
    onSent({ ...outreach, ...updated });
    toast.success("Sent.");
  }

  return (
    <Card className="border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{outreach.business_leads?.name ?? "Unknown lead"}</p>
          <p className="truncate text-xs text-text-muted">{outreach.business_leads?.category}</p>
        </div>
        <StatusBadge label={OUTREACH_STATUS_LABELS[outreach.status]} tone={OUTREACH_STATUS_TONES[outreach.status]} />
      </div>
      <div className="mt-2 space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Input value={subject} disabled={!editable} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Body</Label>
          <Textarea rows={6} value={bodyText} disabled={!editable} onChange={(e) => setBodyText(e.target.value)} />
        </div>
      </div>
      {editable ? (
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      ) : (
        outreach.sent_at && <p className="mt-2 text-xs text-text-muted">Sent {new Date(outreach.sent_at).toLocaleString()}.</p>
      )}
    </Card>
  );
}

export function OutreachQueue() {
  const { data, mutate } = useSWR<{ outreach: LeadOutreachWithLead[] }>("/api/lead-outreach", fetcher);
  const outreach = data?.outreach ?? null;

  function updateOne(updated: LeadOutreachWithLead) {
    mutate((prev) => prev && { outreach: prev.outreach.map((o) => (o.id === updated.id ? updated : o)) }, { revalidate: false });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/local-leads" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Outreach Queue</h1>
      </div>

      {outreach === null ? (
        <div className="space-y-2">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : outreach.length === 0 ? (
        <EmptyState icon={Send} title="No pitches drafted yet" description="Draft a pitch from a lead with an email to see it here." />
      ) : (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">{outreach.length} pitch{outreach.length === 1 ? "" : "es"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {outreach.map((o) => (
              <OutreachCard key={o.id} outreach={o} onSaved={updateOne} onSent={updateOne} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
