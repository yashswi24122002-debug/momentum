"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { IdeaCard } from "@/components/ideas/idea-card";
import { RejectDialog } from "@/components/ideas/reject-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import type { StatusTone } from "@/components/shared/status-badge";
import type { Idea, RejectionReason } from "@/lib/types/ideas";

type FilterTab = "all" | "pending" | "approved" | "rejected" | "saved";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "saved", label: "Saved" },
];

const STATUS_BADGES: Record<Idea["status"], { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export function IdeaHistory() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Idea | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/ideas");
      const json = await res.json();
      setIdeas(json.ideas ?? []);
    }
    load();
  }, []);

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
    setIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, status: "approved" } : i)) ?? null);
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
    setIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, status: "rejected", rejection_reason: reason } : i)) ?? null);
  }

  async function handleToggleSave(idea: Idea) {
    const nextSaved = !idea.saved;
    setIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, saved: nextSaved } : i)) ?? null);
    const res = await fetch(`/api/ideas/${idea.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: nextSaved }),
    });
    if (!res.ok) {
      setIdeas((prev) => prev?.map((i) => (i.id === idea.id ? { ...i, saved: idea.saved } : i)) ?? null);
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
    setIdeas((prev) => prev?.filter((i) => i.id !== deleteTarget.id) ?? null);
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  if (ideas === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const filtered = ideas
    .filter((i) => {
      if (tab === "all") return true;
      if (tab === "saved") return i.saved;
      return i.status === tab;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/ideas" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Idea history</h1>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface-hover text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Archive} title="Nothing here yet" description="Ideas you generate, save, approve, or reject will show up here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((idea) => (
            <div key={idea.id} className="space-y-1">
              <IdeaCard
                idea={idea}
                statusBadge={STATUS_BADGES[idea.status]}
                approving={approvingId === idea.id}
                onApprove={idea.status === "pending" ? () => handleApprove(idea) : undefined}
                onReject={idea.status === "pending" ? () => setRejectTarget(idea) : undefined}
                onToggleSave={() => handleToggleSave(idea)}
                onDelete={() => setDeleteTarget(idea)}
              />
              {idea.status === "approved" && (
                <Link href={`/ideas/${idea.id}`} className="block px-1 text-xs text-primary hover:underline">
                  View full report →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

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
