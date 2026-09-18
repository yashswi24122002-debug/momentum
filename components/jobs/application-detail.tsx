"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Sparkles, Loader2, Download, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/client";
import { fetcher } from "@/lib/swr-fetcher";
import { downloadResumePdf, previewResumePdf, resumePdfBlob } from "@/lib/jobs/resume-pdf";
import { downloadCoverLetterPdf, previewCoverLetterPdf, coverLetterPdfBlob } from "@/lib/jobs/cover-letter-pdf";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONES } from "@/lib/jobs/ui";
import type { JobApplication } from "@/lib/types/resume";

const DOCUMENTS_BUCKET = "documents";

export function ApplicationDetail({ id }: { id: string }) {
  const { data, mutate } = useSWR<{ application: JobApplication }>(`/api/job-applications/${id}`, fetcher);
  const [tailoring, setTailoring] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ contact_email: string; subject: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const application = data?.application ?? null;

  async function tailor() {
    setTailoring(true);
    const res = await fetch(`/api/job-applications/${id}/tailor`, { method: "POST" });
    setTailoring(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't tailor that — try again." }));
      toast.error(error);
      return;
    }
    const { application: updated } = await res.json();
    mutate({ application: updated }, { revalidate: false });
    toast.success("Tailored — review the resume and cover letter below.");
  }

  // Renders both PDFs client-side (same fixed template every time), uploads
  // them to the documents bucket, then records the storage paths — needed
  // before sending, since the outreach email attaches them by storage path.
  async function uploadAttachments() {
    if (!application?.tailored_resume) return;
    setUploadingAttachments(true);
    const supabase = createClient();
    try {
      const resumeBlob = resumePdfBlob(application.tailored_resume);
      const coverBlob = coverLetterPdfBlob({
        applicantName: application.tailored_resume.name,
        company: application.company,
        roleTitle: application.role_title,
        bodyText: application.cover_letter_text ?? "",
      });

      const resumePath = `${crypto.randomUUID()}.pdf`;
      const coverPath = `${crypto.randomUUID()}.pdf`;

      const [resumeUpload, coverUpload] = await Promise.all([
        supabase.storage.from(DOCUMENTS_BUCKET).upload(resumePath, resumeBlob, { contentType: "application/pdf" }),
        supabase.storage.from(DOCUMENTS_BUCKET).upload(coverPath, coverBlob, { contentType: "application/pdf" }),
      ]);
      if (resumeUpload.error || coverUpload.error) throw new Error("upload failed");

      const res = await fetch(`/api/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_pdf_path: resumePath, cover_letter_pdf_path: coverPath }),
      });
      if (!res.ok) throw new Error("save failed");
      const { application: updated } = await res.json();
      mutate({ application: updated }, { revalidate: false });
      toast.success("Attached — ready to send.");
    } catch {
      toast.error("Couldn't prepare attachments — try again.");
    }
    setUploadingAttachments(false);
  }

  async function draftOutreach() {
    if (!contactEmail.trim()) {
      toast.error("Enter the contact's email first.");
      return;
    }
    setDrafting(true);
    const [firstName, ...restName] = contactName.trim().split(/\s+/).filter(Boolean);
    const res = await fetch(`/api/job-applications/${id}/draft-outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_email: contactEmail.trim(),
        contact_first_name: firstName ?? null,
        contact_last_name: restName.join(" ") || null,
      }),
    });
    setDrafting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't draft that — try again." }));
      toast.error(error);
      return;
    }
    const { application: updated } = await res.json();
    mutate({ application: updated }, { revalidate: false });
    setEmailDraft({
      contact_email: updated.contact_email ?? "",
      subject: updated.email_subject ?? "",
      body: updated.email_body_final ?? updated.email_body_draft ?? "",
    });
    toast.success("Drafted — review before sending.");
  }

  async function saveEmailEdits() {
    if (!emailDraft) return;
    const res = await fetch(`/api/job-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_email: emailDraft.contact_email,
        email_subject: emailDraft.subject,
        email_body_final: emailDraft.body,
      }),
    });
    if (!res.ok) {
      toast.error("Couldn't save — try again.");
      return false;
    }
    const { application: updated } = await res.json();
    mutate({ application: updated }, { revalidate: false });
    return true;
  }

  async function send() {
    const savedOk = await saveEmailEdits();
    if (!savedOk) return;
    setSending(true);
    const res = await fetch(`/api/job-applications/${id}/send`, { method: "POST" });
    setSending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't send — try again." }));
      toast.error(error);
      return;
    }
    const { application: updated } = await res.json();
    mutate({ application: updated }, { revalidate: false });
    toast.success("Sent.");
  }

  if (data === undefined || application === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const hasAttachments = !!application.resume_pdf_path && !!application.cover_letter_pdf_path;
  const alreadySent = application.status === "sent" || application.status === "replied";

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/jobs" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-text-primary">{application.role_title}</h1>
          <p className="truncate text-sm text-text-muted">{application.company}</p>
        </div>
        <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={APPLICATION_STATUS_TONES[application.status]} />
      </div>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Job description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{application.jd_text}</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm text-text-secondary">Tailored resume & cover letter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!application.tailored_resume ? (
            <Button onClick={tailor} disabled={tailoring}>
              {tailoring ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {tailoring ? "Tailoring…" : "Tailor my resume"}
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => previewResumePdf(application.tailored_resume!)}>
                  <Eye className="size-3.5" />
                  Preview resume
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadResumePdf(application.tailored_resume!)}>
                  <Download className="size-3.5" />
                  Resume PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    previewCoverLetterPdf({
                      applicantName: application.tailored_resume!.name,
                      company: application.company,
                      roleTitle: application.role_title,
                      bodyText: application.cover_letter_text ?? "",
                    })
                  }
                >
                  <Eye className="size-3.5" />
                  Preview cover letter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCoverLetterPdf({
                      applicantName: application.tailored_resume!.name,
                      company: application.company,
                      roleTitle: application.role_title,
                      bodyText: application.cover_letter_text ?? "",
                    })
                  }
                >
                  <Download className="size-3.5" />
                  Cover letter PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={tailor} disabled={tailoring}>
                  {tailoring ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Re-tailor
                </Button>
              </div>
              {application.cover_letter_text && (
                <Textarea
                  rows={8}
                  value={application.cover_letter_text}
                  readOnly
                  className="text-xs text-text-secondary"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {application.tailored_resume && !emailDraft && !application.email_body_draft && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="name@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact name (optional)</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
              </div>
            </div>
            <Button size="sm" onClick={draftOutreach} disabled={drafting || !contactEmail.trim()}>
              {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {drafting ? "Drafting…" : "Draft outreach email"}
            </Button>
          </CardContent>
        </Card>
      )}

      {(emailDraft || application.email_body_draft) && (
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm text-text-secondary">Outreach email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                value={emailDraft?.contact_email ?? application.contact_email ?? ""}
                disabled={alreadySent}
                onChange={(e) => setEmailDraft((d) => (d ? { ...d, contact_email: e.target.value } : d))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailDraft?.subject ?? application.email_subject ?? ""}
                disabled={alreadySent}
                onChange={(e) => setEmailDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                rows={10}
                value={emailDraft?.body ?? application.email_body_draft ?? ""}
                disabled={alreadySent}
                onChange={(e) => setEmailDraft((d) => (d ? { ...d, body: e.target.value } : d))}
              />
            </div>

            {!alreadySent && (
              <div className="flex flex-wrap items-center gap-2">
                {!hasAttachments ? (
                  <Button variant="outline" size="sm" onClick={uploadAttachments} disabled={uploadingAttachments}>
                    {uploadingAttachments ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    {uploadingAttachments ? "Preparing…" : "Attach resume + cover letter"}
                  </Button>
                ) : (
                  <p className="text-xs text-text-muted">Resume + cover letter attached.</p>
                )}
                <Button size="sm" onClick={send} disabled={sending || !hasAttachments}>
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            )}
            {application.sent_at && <p className="text-xs text-text-muted">Sent {new Date(application.sent_at).toLocaleString()}.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
