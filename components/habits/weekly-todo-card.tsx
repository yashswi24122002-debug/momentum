"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeekMonday } from "@/lib/date";
import type { WeeklyTodoTask } from "@/lib/types/habits";

const EMPTY_TASKS: WeeklyTodoTask[] = [{ text: "", done: false }, { text: "", done: false }, { text: "", done: false }];

export function WeeklyTodoCard() {
  const [loaded, setLoaded] = useState(false);
  const [priority, setPriority] = useState("");
  const [tasks, setTasks] = useState<WeeklyTodoTask[]>(EMPTY_TASKS);
  const [weekStart] = useState(() => startOfWeekMonday(new Date()));

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/weekly-todos?week_start=${weekStart}`);
      const json = await res.json();
      if (json.weekly_todo) {
        setPriority(json.weekly_todo.top_priority ?? "");
        const existing: WeeklyTodoTask[] = json.weekly_todo.top_3_tasks ?? [];
        setTasks([0, 1, 2].map((i) => existing[i] ?? { text: "", done: false }));
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

  function updateTaskText(index: number, text: string) {
    setTasks((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, text } : t));
      return next;
    });
  }

  function commitTasks(next: WeeklyTodoTask[]) {
    save({ top_3_tasks: next });
  }

  function toggleTaskDone(index: number) {
    setTasks((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
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
          <label className="text-xs font-medium text-text-muted">Top 3 tasks</label>
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                checked={task.done}
                onCheckedChange={() => toggleTaskDone(i)}
              />
              <Input
                value={task.text}
                placeholder={`Task ${i + 1}`}
                className={task.done ? "text-text-muted line-through" : undefined}
                onChange={(e) => updateTaskText(i, e.target.value)}
                onBlur={() => commitTasks(tasks)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
