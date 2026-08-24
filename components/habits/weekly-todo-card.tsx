"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeekMonday } from "@/lib/date";
import type { WeeklyTodoTask } from "@/lib/types/habits";

const MIN_TASK_SLOTS = 3;

function withMinSlots(tasks: WeeklyTodoTask[]): WeeklyTodoTask[] {
  if (tasks.length >= MIN_TASK_SLOTS) return tasks;
  return [...tasks, ...Array.from({ length: MIN_TASK_SLOTS - tasks.length }, () => ({ text: "", done: false }))];
}

export function WeeklyTodoCard() {
  const [loaded, setLoaded] = useState(false);
  const [priority, setPriority] = useState("");
  const [tasks, setTasks] = useState<WeeklyTodoTask[]>(withMinSlots([]));
  const [weekStart] = useState(() => startOfWeekMonday(new Date()));

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/weekly-todos?week_start=${weekStart}`);
      const json = await res.json();
      if (json.weekly_todo) {
        setPriority(json.weekly_todo.top_priority ?? "");
        setTasks(withMinSlots(json.weekly_todo.top_3_tasks ?? []));
      }
      setLoaded(true);
    }
    load();
  }, [weekStart]);

  async function save(next: { top_priority?: string; top_3_tasks?: WeeklyTodoTask[] }) {
    const res = await fetch("/api/weekly-todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart, ...next }),
    });
    if (!res.ok) toast.error("Couldn't save that — try again.");
  }

  // Trims trailing blank slots (beyond the minimum) before persisting, so
  // the stored list doesn't accumulate empty rows forever.
  function trimmed(list: WeeklyTodoTask[]): WeeklyTodoTask[] {
    let end = list.length;
    while (end > MIN_TASK_SLOTS && !list[end - 1].text.trim() && !list[end - 1].done) end--;
    return list.slice(0, end);
  }

  function updateTaskText(index: number, text: string) {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, text } : t)));
  }

  function commitTasks(next: WeeklyTodoTask[]) {
    save({ top_3_tasks: trimmed(next) });
  }

  function toggleTaskDone(index: number) {
    setTasks((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
      commitTasks(next);
      return next;
    });
  }

  function addTask() {
    setTasks((prev) => [...prev, { text: "", done: false }]);
  }

  function removeTask(index: number) {
    setTasks((prev) => {
      const next = withMinSlots(prev.filter((_, i) => i !== index));
      commitTasks(next);
      return next;
    });
  }

  if (!loaded) {
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
            onBlur={() => save({ top_priority: priority })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-muted">Priority tasks</label>
            <Button variant="ghost" size="icon-xs" onClick={addTask} aria-label="Add task">
              <Plus className="size-3.5" />
            </Button>
          </div>
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox checked={task.done} onCheckedChange={() => toggleTaskDone(i)} />
              <Input
                value={task.text}
                placeholder={`Task ${i + 1}`}
                className={task.done ? "text-text-muted line-through" : undefined}
                onChange={(e) => updateTaskText(i, e.target.value)}
                onBlur={() => commitTasks(tasks)}
              />
              {tasks.length > MIN_TASK_SLOTS && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-text-muted hover:text-danger"
                  onClick={() => removeTask(i)}
                  aria-label="Remove task"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
