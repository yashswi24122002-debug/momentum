"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings2, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { todayLocalISODate } from "@/lib/date";
import type { Habit, HabitLog } from "@/lib/types/habits";

export function DailyChecklist() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const today = todayLocalISODate();

  useEffect(() => {
    async function load() {
      const [habitsRes, logsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch(`/api/habits/logs?from=${today}&to=${today}`),
      ]);
      const habitsJson = await habitsRes.json();
      const logsJson = await logsRes.json();

      setHabits(habitsJson.habits ?? []);
      setCompletedIds(
        new Set(
          (logsJson.logs as HabitLog[] | undefined)
            ?.filter((log) => log.completed)
            .map((log) => log.habit_id) ?? []
        )
      );
    }
    load();
  }, [today]);

  async function toggle(habitId: string) {
    const wasCompleted = completedIds.has(habitId);
    const nextCompleted = !wasCompleted;

    // Optimistic update — PRD acceptance criteria requires instant feedback.
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (nextCompleted) next.add(habitId);
      else next.delete(habitId);
      return next;
    });

    const res = await fetch(`/api/habits/${habitId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, completed: nextCompleted }),
    });

    if (!res.ok) {
      // Roll back on failure.
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (wasCompleted) next.add(habitId);
        else next.delete(habitId);
        return next;
      });
      toast.error("Couldn't save that — try again.");
    }
  }

  if (habits === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No habits yet"
        description="Add your first daily habit to start tracking your streaks and consistency."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {completedIds.size} of {habits.length} done today
        </p>
        <Button variant="ghost" size="sm" render={<Link href="/habits/manage" />} nativeButton={false}>
          <Settings2 className="size-4" />
          Manage
        </Button>
      </div>
      {habits.map((habit) => {
        const completed = completedIds.has(habit.id);
        return (
          <Card
            key={habit.id}
            className="flex flex-row items-center gap-3 border-border bg-surface p-3"
          >
            <Checkbox
              id={`habit-${habit.id}`}
              checked={completed}
              onCheckedChange={() => toggle(habit.id)}
              className="size-5"
            />
            <label
              htmlFor={`habit-${habit.id}`}
              className={`flex-1 text-sm font-medium ${
                completed ? "text-text-muted line-through" : "text-text-primary"
              }`}
            >
              {habit.name}
            </label>
            {habit.category && (
              <span className="text-xs text-text-muted">{habit.category}</span>
            )}
          </Card>
        );
      })}
    </div>
  );
}
