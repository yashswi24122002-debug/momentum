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
import { todayLocalISODate } from "@/lib/date";

type Task = { id: string; text: string; done: boolean; done_on: string | null };
type TasksResponse = { tasks: Task[] };

// Ad-hoc, separate from tracked habits: no streaks, no grid/dashboard
// presence. A pending task has no date tied to it, so it keeps showing up
// every day until it's checked off or removed — only a *done* task is
// day-scoped (visible the day it was completed, gone the next day;
// app/api/daily-todos/route.ts drops anything done before today on every
// read, so nothing done is ever kept as history).
export function DailyTasksCard() {
  const [date] = useState(() => todayLocalISODate());
  const { data, mutate } = useSWR<TasksResponse>(`/api/daily-todos?date=${date}`, fetcher);
  const [newText, setNewText] = useState("");

  const tasks = data?.tasks ?? [];

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setNewText("");

    const res = await fetch("/api/daily-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      toast.error("Couldn't add that — try again.");
      return;
    }
    const { task } = (await res.json()) as { task: Task };
    mutate((prev) => (prev ? { tasks: [...prev.tasks, task] } : prev), { revalidate: false });
  }

  async function toggleTask(task: Task) {
    const nextDone = !task.done;
    const previous = tasks;
    mutate(
      {
        tasks: nextDone
          ? tasks.map((t) => (t.id === task.id ? { ...t, done: true, done_on: date } : t))
          : // Un-checking a task that was done on an earlier day (still
            // visible today only because it was just toggled from the
            // list) needs to stay in view rather than vanish immediately.
            tasks.map((t) => (t.id === task.id ? { ...t, done: false, done_on: null } : t)),
      },
      { revalidate: false }
    );

    const res = await fetch(`/api/daily-todos/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: nextDone, date }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      mutate({ tasks: previous }, { revalidate: false });
    }
  }

  async function removeTask(id: string) {
    const previous = tasks;
    mutate({ tasks: tasks.filter((t) => t.id !== id) }, { revalidate: false });
    const res = await fetch(`/api/daily-todos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't remove that — try again.");
      mutate({ tasks: previous }, { revalidate: false });
    }
  }

  if (data === undefined) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-sm text-text-secondary">Today&apos;s tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={addTask} className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a one-off task"
          />
          <Button type="submit" size="icon" variant="outline">
            <Plus className="size-4" />
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-xs text-text-muted">Nothing here — a task stays until you check it off.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
