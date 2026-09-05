"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Sparkles, Loader2, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap } from "lucide-react";
import { UniversityCard } from "@/components/masters-abroad/university-card";
import { DiscoveryDialog } from "@/components/masters-abroad/discovery-dialog";
import { ComparisonDialog } from "@/components/masters-abroad/comparison-dialog";
import { DeadlineHints } from "@/components/masters-abroad/deadline-hints";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { fetcher } from "@/lib/swr-fetcher";
import { UNIVERSITY_STATUS_ORDER, UNIVERSITY_STATUS_LABELS } from "@/lib/masters-abroad/ui";
import type { University, UniversityStatus, DiscoveryProfile } from "@/lib/types/masters-abroad";

const MAX_COMPARE = 3;

export function UniversityBoard() {
  const { data, mutate } = useSWR<{ universities: University[] }>("/api/universities", fetcher);
  const universities = data?.universities;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<University | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDiscover(profile: DiscoveryProfile) {
    setDiscovering(true);
    const res = await fetch("/api/universities/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setDiscovering(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't find universities — try again." }));
      toast.error(error);
      return;
    }
    const { universities: found } = await res.json();
    mutate((prev) => ({ universities: [...found, ...(prev?.universities ?? [])] }), { revalidate: false });
    setDialogOpen(false);
    toast.success(`Found ${found.length} suggestions — review and verify before trusting any deadlines.`);
  }

  async function handleStatusChange(id: string, status: UniversityStatus) {
    mutate((prev) => prev && { universities: prev.universities.map((u) => (u.id === id ? { ...u, status } : u)) }, { revalidate: false });
    const res = await fetch(`/api/universities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) toast.error("Couldn't update that — try again.");
  }

  async function handleToggleVerified(id: string, verified: boolean) {
    mutate((prev) => prev && { universities: prev.universities.map((u) => (u.id === id ? { ...u, verified } : u)) }, { revalidate: false });
    const res = await fetch(`/api/universities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    });
    if (!res.ok) toast.error("Couldn't update that — try again.");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} at a time.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/universities/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    mutate((prev) => prev && { universities: prev.universities.filter((u) => u.id !== deleteTarget.id) }, { revalidate: false });
    setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  if (universities === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const selectedUniversities = universities.filter((u) => selectedIds.includes(u.id));

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" render={<Link href="/masters-abroad" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold text-text-primary">Universities</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={discovering}>
          {discovering ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Discover
        </Button>
      </div>

      <DeadlineHints />

      {universities.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No universities yet"
          description="Discover AI-suggested German universities, or add one manually once you know where you're applying."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UNIVERSITY_STATUS_ORDER.map((status) => {
            const inStatus = universities.filter((u) => u.status === status);
            if (inStatus.length === 0) return null;
            return (
              <div key={status} className="col-span-full space-y-2">
                <h2 className="text-sm font-medium text-text-secondary">
                  {UNIVERSITY_STATUS_LABELS[status]} ({inStatus.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inStatus.map((u) => (
                    <UniversityCard
                      key={u.id}
                      university={u}
                      onStatusChange={(s) => handleStatusChange(u.id, s)}
                      onToggleVerified={() => handleToggleVerified(u.id, !u.verified)}
                      onDelete={() => setDeleteTarget(u)}
                      selected={selectedIds.includes(u.id)}
                      onToggleSelected={() => toggleSelected(u.id)}
                      selectionDisabled={selectedIds.length >= MAX_COMPARE}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.length >= 2 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center md:ml-28">
          <Button size="lg" onClick={() => setCompareOpen(true)} className="shadow-lg">
            <Columns3 className="size-4" />
            Compare ({selectedIds.length})
          </Button>
        </div>
      )}

      <DiscoveryDialog open={dialogOpen} onOpenChange={setDialogOpen} onDiscover={handleDiscover} discovering={discovering} />
      <ComparisonDialog universities={selectedUniversities} open={compareOpen} onOpenChange={setCompareOpen} />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This also deletes any tasks scoped specifically to this university. This can't be undone."
      />
    </div>
  );
}
