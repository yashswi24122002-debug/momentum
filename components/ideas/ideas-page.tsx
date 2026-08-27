"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Sparkles, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { IdeaCard } from "@/components/ideas/idea-card";
import { RejectDialog } from "@/components/ideas/reject-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PipelineBoard, type ReportWithIdea } from "@/components/ideas/pipeline-board";
import { WeeklyDigestCard } from "@/components/ideas/weekly-digest";
import { computeWeeklyDigest } from "@/lib/ideas/digest";
import { todayLocalISODate } from "@/lib/date";
import type { Idea, RejectionReason } from "@/lib/types/ideas";

export function IdeasPage() {
  const [allIdeas, setAllIdeas] = useState<Idea[] | null>(null);
  const [reports, setReports] = useState<ReportWithIdea[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Idea | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [deleting, setDeleting] = useState(false);
  const today = todayLocalISODate();

  async function loadAll() {
    const [ideasRes, reportsRes] = await Promise.all([fetch("/api/ideas"), fetch("/api/idea-reports")]);
    setAllIdeas((await ideasRes.json()).ideas ?? []);
    setReports((await reportsRes.json()).reports ?? []);
  }

  useEffect(() => {
    async function load() {
      const [ideasRes, reportsRes] = await Promise.all([fetch("/api/ideas"), fetch("/api/idea-reports")]);
      setAllIdeas((await ideasRes.json()).ideas ?? []);
      setReports((await reportsRes.json()).reports ?? []);
    }
    load();
  }, []);

  const pendingToday = (allIdeas ?? []).filter((i) => i.status === "pending" && i.date_generated === today);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/ideas/generate", { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't generate ideas — try again." }));
      toast.error(error);
      return;
    }
    await loadAll();
  }

  async function handleApprove(idea: Idea) {
    setApprovingId(idea.id);
    const res = await fetch(`/api/ideas/${idea.id}/approve`, { method: "POST" });
    setApprovingId(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't approve that idea — try again." }));
      toast.error(error);
      return;
    }
    toast.success(`"${idea.title}" moved to backlog with a full report.`);
    await loadAll();
  }

  async function handleReject(reason: RejectionReason) {
    if (!rejectTarget) return;
    const idea = rejectTarget;
    setRejectTarget(null);
    const res = await fetch(`/api/ideas/${idea.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      toast.error("Couldn't reject that idea — try again.");
      return;
    }
    setAllIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, status: "rejected", rejection_reason: reason } : i)) ?? null);
  }

  async function handleToggleSave(idea: Idea) {
    const nextSaved = !idea.saved;
    setAllIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, saved: nextSaved } : i)) ?? null);
    const res = await fetch(`/api/ideas/${idea.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: nextSaved }),
    });
    if (!res.ok) {
      setAllIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, saved: idea.saved } : i)) ?? null);
      toast.error("Couldn't save that — try again.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/ideas/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    setAllIdeas((prev) => prev?.filter((i) => i.id !== deleteTarget.id) ?? null);
    setReports((prev) => prev?.filter((r) => r.idea_id !== deleteTarget.id) ?? null);
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  if (allIdeas === null || reports === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const digest = computeWeeklyDigest(allIdeas, reports, today);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Ideas</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/ideas/history" />} nativeButton={false}>
            <History className="size-4" />
            History
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Generating…" : "Generate Today's Ideas"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {pendingToday.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No ideas generated yet today"
              description="Generate today's ideas to get 5 project concepts sourced from trending tech signals."
            />
          ) : (
            pendingToday.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                approving={approvingId === idea.id}
                onApprove={() => handleApprove(idea)}
                onReject={() => setRejectTarget(idea)}
                onToggleSave={() => handleToggleSave(idea)}
                onDelete={() => setDeleteTarget(idea)}
              />
            ))
          )}
        </div>
        <WeeklyDigestCard digest={digest} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-text-secondary">Pipeline</h2>
        <PipelineBoard reports={reports} />
      </div>

      <RejectDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        onConfirm={handleReject}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This permanently deletes the idea and its report (if approved). This can't be undone."
      />
    </div>
  );
}
