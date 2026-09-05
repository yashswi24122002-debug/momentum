"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListChecks } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { isTaskBlocked } from "@/lib/masters-abroad/dependencies";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/masters-abroad/ui";
import { cn } from "@/lib/utils";
import type { Task, TaskCategory } from "@/lib/types/masters-abroad";

export function TaskListPage() {
  const { data, mutate } = useSWR<{ tasks: Task[] }>("/api/tasks", fetcher);
  const tasks = data?.tasks;
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  async function seedDefaults() {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_default" }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't seed default tasks." }));
      toast.error(error);
      return;
    }
    const { tasks: seeded } = await res.json();
    mutate({ tasks: seeded }, { revalidate: false });
  }

  async function toggleDone(task: Task, allTasks: Task[]) {
    const nextStatus = task.status === "done" ? "not_started" : "done";
    if (nextStatus === "done" && isTaskBlocked(task, allTasks)) {
      toast.error("This task has unfinished dependencies.");
      return;
    }
    const previous = data;
    mutate(
      (prev) =>
        prev && {
          tasks: prev.tasks.map((t) =>
            t.id === task.id ? { ...t, status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null } : t
          ),
        },
      { revalidate: false }
    );
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      mutate(previous, { revalidate: false });
      const { error } = await res.json().catch(() => ({ error: "Couldn't update that task." }));
      toast.error(error);
    }
  }

  if (tasks === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const filtered = tasks.filter((t) => categoryFilter === "all" || t.category === categoryFilter);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" render={<Link href="/masters-abroad" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold text-text-primary">Tasks</h1>
        </div>
        {tasks.length > 0 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet" description="Seed the default checklist to start tracking documents, exams, and deadlines." />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const blocked = task.status !== "done" && isTaskBlocked(task, tasks);
            return (
              <Card
                key={task.id}
                className={cn("flex flex-row items-center gap-3 border-border p-3", blocked ? "bg-background opacity-60" : "bg-surface")}
              >
                <Checkbox
                  checked={task.status === "done"}
                  disabled={blocked}
                  onCheckedChange={() => toggleDone(task, tasks)}
                  className="size-5"
                />
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", task.status === "done" ? "text-text-muted line-through" : "text-text-primary")}>
                    {task.title}
                  </p>
                  {task.instructions && <p className="text-xs text-text-secondary">{task.instructions}</p>}
                  {blocked && (
                    <p className="flex items-center gap-1 text-xs text-warning">
                      <Lock className="size-3" />
                      Waiting on other tasks
                    </p>
                  )}
                </div>
                {task.category && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-muted">{CATEGORY_LABELS[task.category as TaskCategory]}</span>}
                {task.deadline && <span className="text-xs text-text-muted">{task.deadline}</span>}
                {task.where_to_apply_url && (
                  <a href={task.where_to_apply_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-primary">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tasks.length === 0 && (
        <Button onClick={seedDefaults} className="self-start">
          Seed default checklist
        </Button>
      )}
    </div>
  );
}
