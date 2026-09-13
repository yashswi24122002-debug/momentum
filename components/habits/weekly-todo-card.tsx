"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/swr-fetcher";
import { startOfWeekMonday } from "@/lib/date";
import type { WeeklyTodoTask } from "@/lib/types/habits";

type WeeklyTodoResponse = {
  weekly_todo: { top_priority: string | null } | null;
  tasks: WeeklyTodoTask[];
};

export function WeeklyTodoCard() {
  const [weekStart] = useState(() => startOfWeekMonday(new Date()));
  const { data, mutate } = useSWR<WeeklyTodoResponse>(`/api/weekly-todos?week_start=${weekStart}`, fetcher);

  const [priority, setPriority] = useState("");
  const [newText, setNewText] = useState("");
  // The fetched top_priority is only used to seed this editable field once
  // — after that, local state (edited via onChange/onBlur below) is the
  // source of truth, so a background revalidation doesn't clobber an
  // in-progress edit. Tasks don't need this: they're never edited in
  // place, only added/toggled/removed, so the SWR cache can stay the
  // source of truth for them directly.
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && data !== undefined) {
    setHydrated(true);
    setPriority(data.weekly_todo?.top_priority ?? "");
  }

  const tasks = data?.tasks ?? [];

  async function savePriority() {
    const res = await fetch("/api/weekly-todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, top_priority: priority }),
    });
    if (!res.ok) toast.error("Couldn't save that — try again.");
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setNewText("");

    const res = await fetch("/api/weekly-todos/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      toast.error("Couldn't add that — try again.");
      return;
    }
    const { task } = (await res.json()) as { task: WeeklyTodoTask };
    mutate((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : prev), { revalidate: false });
  }

  async function toggleTask(task: WeeklyTodoTask) {
    const nextDone = !task.done;
    const previous = tasks;
    mutate(
      (prev) =>
        prev && {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id ? { ...t, done: nextDone, done_on_week: nextDone ? weekStart : null } : t
          ),
        },
      { revalidate: false }
    );

    const res = await fetch(`/api/weekly-todos/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: nextDone, week_start: weekStart }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      mutate((prev) => prev && { ...prev, tasks: previous }, { revalidate: false });
    }
  }

  async function removeTask(id: string) {
    const previous = tasks;
    mutate((prev) => prev && { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }, { revalidate: false });
    const res = await fetch(`/api/weekly-todos/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't remove that — try again.");
      mutate((prev) => prev && { ...prev, tasks: previous }, { revalidate: false });
    }
  }

  if (data === undefined) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-sm text-text-secondary">This week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted">Top priority</label>
          <Input
            value={priority}
            placeholder="What matters most this week?"
            onChange={(e) => setPriority(e.target.value)}
            onBlur={savePriority}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted">Priority tasks</label>
          <form onSubmit={addTask} className="flex gap-2">
            <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Add a priority task" />
            <Button type="submit" size="icon-sm" variant="outline">
              <Plus className="size-3.5" />
            </Button>
          </form>
          {tasks.length === 0 ? (
            <p className="text-xs text-text-muted">Nothing here yet — a task stays until you check it off, even into next week.</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <Checkbox checked={task.done} onCheckedChange={() => toggleTask(task)} />
                <span className={task.done ? "flex-1 text-sm text-text-muted line-through" : "flex-1 text-sm text-text-primary"}>
                  {task.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-text-muted hover:text-danger"
                  onClick={() => removeTask(task.id)}
                  aria-label="Remove task"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
