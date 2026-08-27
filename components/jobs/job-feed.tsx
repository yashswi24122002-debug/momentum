"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Send, ListChecks, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { JobCard } from "@/components/jobs/job-card";
import { DraftOutreachDialog } from "@/components/jobs/draft-outreach-dialog";
import { CheckContactDialog } from "@/components/jobs/check-contact-dialog";
import { JOB_STATUS_ORDER, JOB_STATUS_LABELS } from "@/lib/jobs/ui";
import type { JobPosting, JobPostingStatus } from "@/lib/types/jobs";
import type { HunterContact } from "@/lib/integrations/hunter";

// Every inserted posting already passed the role-title gate in
// computeFitScore (see lib/jobs/fit-score.ts), so scores start at 40 —
// these options rank by tech-stack overlap within that matched set.
const FIT_SCORE_OPTIONS = [
  { label: "All", value: 0 },
  { label: "60+", value: 60 },
  { label: "80+", value: 80 },
];

const ALL_SOURCES = "__all__";
type SortBy = "fit" | "newest";

export function JobFeed() {
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [filter, setFilter] = useState<JobPostingStatus>("new");
  const [minFitScore, setMinFitScore] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<JobPosting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draftTarget, setDraftTarget] = useState<JobPosting | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftContact, setDraftContact] = useState<HunterContact | null>(null);
  const [checkContactTarget, setCheckContactTarget] = useState<JobPosting | null>(null);
  const [search, setSearch] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState(ALL_SOURCES);
  const [sortBy, setSortBy] = useState<SortBy>("fit");

  useEffect(() => {
    async function load() {
      setJobs(null);
      const res = await fetch(`/api/jobs?minFitScore=${minFitScore}`);
      const json = await res.json();
      setJobs(json.jobs ?? []);
    }
    load();
  }, [minFitScore]);

  async function handleStatusChange(id: string, status: JobPostingStatus) {
    setJobs((prev) => prev?.map((j) => (j.id === id ? { ...j, status } : j)) ?? null);
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) toast.error("Couldn't update that — try again.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/jobs/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    setJobs((prev) => prev?.filter((j) => j.id !== deleteTarget.id) ?? null);
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  async function handleDraftOutreach(resumeId: string | null) {
    if (!draftTarget) return;
    setDrafting(true);
    const res = await fetch(`/api/jobs/${draftTarget.id}/draft-outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_id: resumeId,
        contact_email: draftContact?.email ?? undefined,
        contact_first_name: draftContact?.firstName ?? undefined,
        contact_last_name: draftContact?.lastName ?? undefined,
      }),
    });
    setDrafting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't draft that email — try again." }));
      toast.error(error);
      return;
    }
    const { contactFound } = await res.json();
    setDraftTarget(null);
    setDraftContact(null);
    toast.success(
      contactFound
        ? "Draft ready — review it in the outreach queue."
        : "Draft ready, but no contact email was found — add one manually in the outreach queue."
    );
  }

  if (jobs === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const sources = Array.from(new Set(jobs.map((j) => j.source))).sort();

  const query = search.trim().toLowerCase();
  const filtered = jobs
    .filter((j) => j.status === filter)
    .filter((j) => (remoteOnly ? j.remote : true))
    .filter((j) => (sourceFilter === ALL_SOURCES ? true : j.source === sourceFilter))
    .filter((j) => (query ? j.company.toLowerCase().includes(query) || j.role_title.toLowerCase().includes(query) : true))
    .sort((a, b) => {
      if (sortBy === "newest") {
        return (b.posted_date ?? "").localeCompare(a.posted_date ?? "");
      }
      return (b.fit_score ?? 0) - (a.fit_score ?? 0);
    });

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/jobs/outreach-queue" />} nativeButton={false}>
            <Send className="size-3.5" />
            Outreach queue
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/jobs/pipeline" />} nativeButton={false}>
            <ListChecks className="size-3.5" />
            Pipeline
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {JOB_STATUS_ORDER.map((status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {JOB_STATUS_LABELS[status]} ({jobs.filter((j) => j.status === status).length})
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Min fit</span>
          {FIT_SCORE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={minFitScore === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setMinFitScore(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or role…"
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? ALL_SOURCES)}>
          <SelectTrigger size="sm" className="w-36 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SOURCES}>All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy((v as SortBy) ?? "fit")}>
          <SelectTrigger size="sm" className="w-32 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Best fit</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>

        <Button variant={remoteOnly ? "default" : "outline"} size="sm" onClick={() => setRemoteOnly((v) => !v)}>
          Remote only
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={`No ${JOB_STATUS_LABELS[filter].toLowerCase()} postings`}
          description="Postings are aggregated daily from Greenhouse, Lever, RemoteOK, Remotive, Arbeitnow, Adzuna, Jooble, and hiring.cafe."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onMarkReviewed={job.status === "new" ? () => handleStatusChange(job.id, "reviewed") : undefined}
              onDismiss={job.status !== "dismissed" ? () => handleStatusChange(job.id, "dismissed") : undefined}
              onDelete={() => setDeleteTarget(job)}
              onCheckContact={() => setCheckContactTarget(job)}
              onDraftOutreach={() => {
                setDraftContact(null);
                setDraftTarget(job);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.role_title}"?`}
        description="This can't be undone."
      />

      {draftTarget && (
        <DraftOutreachDialog
          open={draftTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDraftTarget(null);
              setDraftContact(null);
            }
          }}
          onConfirm={handleDraftOutreach}
          drafting={drafting}
          jobTitle={`${draftTarget.role_title} at ${draftTarget.company}`}
          preselectedContactName={
            draftContact ? [draftContact.firstName, draftContact.lastName].filter(Boolean).join(" ") || draftContact.email : null
          }
        />
      )}

      {checkContactTarget && (
        <CheckContactDialog
          open={checkContactTarget !== null}
          onOpenChange={(open) => !open && setCheckContactTarget(null)}
          jobId={checkContactTarget.id}
          jobTitle={`${checkContactTarget.role_title} at ${checkContactTarget.company}`}
          onSelectContact={(contact) => {
            const job = checkContactTarget;
            setCheckContactTarget(null);
            setDraftContact(contact);
            setDraftTarget(job);
          }}
        />
      )}
    </div>
  );
}
