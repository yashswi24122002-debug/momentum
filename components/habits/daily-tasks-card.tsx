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

type Task = { text: string; done: boolean };
type DailyTodoResponse = { daily_todo: { tasks: Task[] } | null };

// Ad-hoc, same-day-only tasks — deliberately separate from tracked habits:
// no streaks, no grid/dashboard presence, no history. Tomorrow the server
// won't return today's rows at all (app/api/daily-todos/route.ts deletes
// anything before "today" on every read), so there's nothing to carry over.
export function DailyTasksCard() {
  const [date] = useState(() => todayLocalISODate());
  const { data, mutate } = useSWR<DailyTodoResponse>(`/api/daily-todos?date=${date}`, fetcher);
  const [newText, setNewText] = useState("");

  const tasks = data?.daily_todo?.tasks ?? [];

  async function save(next: Task[]) {
    mutate({ daily_todo: { tasks: next } }, { revalidate: false });
    const res = await fetch("/api/daily-todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, tasks: next }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      mutate();
    }
  }

  function addTask(e: FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    save([...tasks, { text: newText.trim(), done: false }]);
    setNewText("");
  }

  function toggleTask(index: number) {
    save(tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
  }

  function removeTask(index: number) {
    save(tasks.filter((_, i) => i !== index));
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
            placeholder="Add a one-off task for today"
          />
          <Button type="submit" size="icon" variant="outline">
            <Plus className="size-4" />
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-xs text-text-muted">Nothing added yet — these clear automatically at the end of the day.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox checked={task.done} onCheckedChange={() => toggleTask(i)} />
                <span className={task.done ? "flex-1 text-sm text-text-muted line-through" : "flex-1 text-sm text-text-primary"}>
                  {task.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-text-muted hover:text-danger"
                  onClick={() => removeTask(i)}
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
