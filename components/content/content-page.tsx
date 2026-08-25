"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Sparkles, Loader2, Images, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ContentIdeaCard } from "@/components/content/content-idea-card";
import { RejectDialog } from "@/components/content/reject-dialog";
import { PipelineBoard, type ReportWithIdea } from "@/components/content/pipeline-board";
import { todayLocalISODate } from "@/lib/date";
import type { ContentIdea, ContentRejectionReason } from "@/lib/types/content";

export function ContentPage() {
  const [allIdeas, setAllIdeas] = useState<ContentIdea[] | null>(null);
  const [reports, setReports] = useState<ReportWithIdea[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContentIdea | null>(null);
  const today = todayLocalISODate();

  async function loadAll() {
    const [ideasRes, reportsRes] = await Promise.all([fetch("/api/content"), fetch("/api/content-reports")]);
    setAllIdeas((await ideasRes.json()).content_ideas ?? []);
    setReports((await reportsRes.json()).reports ?? []);
  }

  useEffect(() => {
    async function load() {
      const [ideasRes, reportsRes] = await Promise.all([fetch("/api/content"), fetch("/api/content-reports")]);
      setAllIdeas((await ideasRes.json()).content_ideas ?? []);
      setReports((await reportsRes.json()).reports ?? []);
    }
    load();
  }, []);

  const pendingToday = (allIdeas ?? []).filter((i) => i.status === "pending" && i.date_generated === today);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/content/generate", { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't generate ideas — try again." }));
      toast.error(error);
      return;
    }
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
    setAllIdeas(
      (prev) => prev?.map((i) => (i.id === idea.id ? { ...i, status: "rejected", rejection_reason: reason } : i)) ?? null
    );
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
          <Button onClick={handleGenerate} disabled={generating}>
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
    </div>
  );
}
