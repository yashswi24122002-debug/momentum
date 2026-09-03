"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Camera, Sparkles, Loader2, Images, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ContentIdeaCard } from "@/components/content/content-idea-card";
import { RejectDialog } from "@/components/content/reject-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { GenerateDialog, type GenerateContext } from "@/components/content/generate-dialog";
import { PipelineBoard, type ReportWithIdea } from "@/components/content/pipeline-board";
import { fetcher } from "@/lib/swr-fetcher";
import { todayLocalISODate } from "@/lib/date";
import type { ContentIdea, ContentRejectionReason } from "@/lib/types/content";

export function ContentPage() {
  const { data: ideasData, mutate: mutateIdeas } = useSWR<{ content_ideas: ContentIdea[] }>("/api/content", fetcher);
  const { data: reportsData, mutate: mutateReports } = useSWR<{ reports: ReportWithIdea[] }>("/api/content-reports", fetcher);
  const allIdeas = ideasData?.content_ideas ?? null;
  const reports = reportsData?.reports ?? null;

  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContentIdea | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentIdea | null>(null);
  const [deleting, setDeleting] = useState(false);
  const today = todayLocalISODate();

  async function loadAll() {
    await Promise.all([mutateIdeas(), mutateReports()]);
  }

  const pendingToday = (allIdeas ?? []).filter((i) => i.status === "pending" && i.date_generated === today);

  async function handleGenerate(context: GenerateContext) {
    setGenerating(true);
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    setGenerating(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't generate ideas — try again." }));
      toast.error(error);
      return;
    }
    setGenerateDialogOpen(false);
    await loadAll();
  }

  async function handleApprove(idea: ContentIdea) {
    setApprovingId(idea.id);
    const res = await fetch(`/api/content/${idea.id}/approve`, { method: "POST" });
    setApprovingId(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't approve that idea — try again." }));
      toast.error(error);
      return;
    }
    toast.success(`"${idea.title}" moved to backlog with a full report.`);
    await loadAll();
  }

  async function handleReject(reason: ContentRejectionReason) {
    if (!rejectTarget) return;
    const idea = rejectTarget;
    setRejectTarget(null);
    const res = await fetch(`/api/content/${idea.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      toast.error("Couldn't reject that idea — try again.");
      return;
    }
    mutateIdeas(
      (prev) =>
        prev && {
          content_ideas: prev.content_ideas.map((i) => (i.id === idea.id ? { ...i, status: "rejected", rejection_reason: reason } : i)),
        },
      { revalidate: false }
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/content/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    mutateIdeas((prev) => prev && { content_ideas: prev.content_ideas.filter((i) => i.id !== deleteTarget.id) }, { revalidate: false });
    mutateReports((prev) => prev && { reports: prev.reports.filter((r) => r.content_idea_id !== deleteTarget.id) }, {
      revalidate: false,
    });
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Content</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/content/history" />} nativeButton={false}>
            <History className="size-4" />
            History
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/content/library" />} nativeButton={false}>
            <Images className="size-4" />
            Library
          </Button>
          <Button onClick={() => setGenerateDialogOpen(true)} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Generating…" : "Generate Today's Ideas"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {pendingToday.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No content ideas yet today"
            description="Generate today's ideas to get 3 Instagram content concepts matched to your photo library."
          />
        ) : (
          pendingToday.map((idea) => (
            <ContentIdeaCard
              key={idea.id}
              idea={idea}
              approving={approvingId === idea.id}
              onApprove={() => handleApprove(idea)}
              onReject={() => setRejectTarget(idea)}
              onDelete={() => setDeleteTarget(idea)}
            />
          ))
        )}
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

      <GenerateDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        onGenerate={handleGenerate}
        generating={generating}
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
