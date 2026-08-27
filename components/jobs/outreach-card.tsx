"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_TONES } from "@/lib/jobs/ui";
import type { Outreach } from "@/lib/types/jobs";

type OutreachWithJob = Outreach & { job_postings: { company: string; role_title: string; url: string | null } | null };

export function OutreachCard({
  outreach,
  onApprove,
  onSaveEdits,
}: {
  outreach: OutreachWithJob;
  onApprove: () => void;
  onSaveEdits: (fields: { email_subject: string; email_body_final: string; contact_email: string }) => void;
}) {
  const [subject, setSubject] = useState(outreach.email_subject ?? "");
  const [body, setBody] = useState(outreach.email_body_final ?? outreach.email_body_draft ?? "");
  const [contactEmail, setContactEmail] = useState(outreach.contact_email ?? "");
  const [dirty, setDirty] = useState(false);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  return (
    <Card className="gap-3 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {outreach.job_postings?.role_title ?? "Unknown role"}
          </h3>
          <p className="text-xs text-text-secondary">{outreach.job_postings?.company}</p>
        </div>
        <StatusBadge label={OUTREACH_STATUS_LABELS[outreach.status]} tone={OUTREACH_STATUS_TONES[outreach.status]} />
      </div>

      {outreach.job_postings?.url && (
        <a
          href={outreach.job_postings.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          View posting
        </a>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Contact email</label>
        <Input
          value={contactEmail}
          onChange={(e) => {
            setContactEmail(e.target.value);
            markDirty();
          }}
          placeholder="No contact found — add one manually"
          disabled={outreach.status !== "draft"}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Subject</label>
        <Input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            markDirty();
          }}
          disabled={outreach.status !== "draft"}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Body</label>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            markDirty();
          }}
          rows={8}
          disabled={outreach.status !== "draft"}
        />
      </div>

      {outreach.status === "draft" && (
        <div className="flex justify-end gap-2 pt-1">
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSaveEdits({ email_subject: subject, email_body_final: body, contact_email: contactEmail });
                setDirty(false);
              }}
            >
              Save edits
            </Button>
          )}
          <Button
            size="sm"
            disabled={!contactEmail}
            onClick={() => {
              if (dirty) onSaveEdits({ email_subject: subject, email_body_final: body, contact_email: contactEmail });
              onApprove();
            }}
          >
            Approve to send
          </Button>
        </div>
      )}

      {outreach.status === "sent" && outreach.sent_at && (
        <p className="text-xs text-text-muted">Sent {new Date(outreach.sent_at).toLocaleString()}</p>
      )}
    </Card>
  );
}
