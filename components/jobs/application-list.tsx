"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, FileText, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { fetcher } from "@/lib/swr-fetcher";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONES } from "@/lib/jobs/ui";
import type { JobApplication } from "@/lib/types/resume";

type ListRow = Pick<JobApplication, "id" | "company" | "role_title" | "url" | "status" | "contact_email" | "sent_at" | "created_at">;

export function ApplicationList() {
  const { data, mutate } = useSWR<{ applications: ListRow[] }>("/api/job-applications", fetcher);
  const [newOpen, setNewOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applications = data?.applications ?? null;

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !roleTitle.trim() || !jdText.trim()) {
      toast.error("Company, role, and the job description are required.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/job-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, role_title: roleTitle, jd_text: jdText, url: url || null }),
    });
    setCreating(false);
    if (!res.ok) {
      toast.error("Couldn't create that — try again.");
      return;
    }
    const { application } = await res.json();
    mutate((prev) => prev && { applications: [application, ...prev.applications] }, { revalidate: false });
    setNewOpen(false);
    setCompany("");
    setRoleTitle("");
    setUrl("");
    setJdText("");
    toast.success("Added — open it to tailor your resume.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/job-applications/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    mutate((prev) => prev && { applications: prev.applications.filter((a) => a.id !== deleteTarget.id) }, { revalidate: false });
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  if (applications === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/jobs/resume" />} nativeButton={false}>
            <FileText className="size-3.5" />
            My Resume
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-3.5" />
            New application
          </Button>
        </div>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Paste a job description to tailor your resume and draft outreach for it."
        />
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <Card key={app.id} className="flex flex-row items-center gap-3 border-border bg-surface p-3">
              <Link href={`/jobs/${app.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{app.role_title}</p>
                <p className="truncate text-xs text-text-muted">{app.company}</p>
              </Link>
              <StatusBadge label={APPLICATION_STATUS_LABELS[app.status]} tone={APPLICATION_STATUS_TONES[app.status]} />
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-text-muted hover:bg-danger/10 hover:text-danger"
                onClick={() => setDeleteTarget(app)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Posting URL (optional)</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label>Job description</Label>
              <Textarea
                rows={8}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the full JD here…"
                className="max-h-64 overflow-y-auto"
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.role_title}"?`}
        description="This removes the tailored resume, cover letter, and any outreach drafted for it. This can't be undone."
      />
    </div>
  );
}
