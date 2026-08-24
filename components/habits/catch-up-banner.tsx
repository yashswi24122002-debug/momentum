"use client";

import { useEffect, useState } from "react";
import { X, History } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { addDays, todayLocalISODate, toLocalISODate } from "@/lib/date";
import { isScheduledOn } from "@/lib/habits/schedule";
import type { Habit, HabitLog } from "@/lib/types/habits";

function dismissKey(date: string) {
  return `momentum:habits:catchup-dismissed:${date}`;
}

/** Dismissible prompt for habits that were scheduled yesterday but never marked done. */
export function CatchUpBanner() {
  const yesterday = addDays(todayLocalISODate(), -1);
  const [pending, setPending] = useState<Habit[] | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey(yesterday)) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) return;

    async function load() {
      const [habitsRes, logsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch(`/api/habits/logs?from=${yesterday}&to=${yesterday}`),
      ]);
      const habits: Habit[] = (await habitsRes.json()).habits ?? [];
      const logs: HabitLog[] = (await logsRes.json()).logs ?? [];
      const doneIds = new Set(logs.filter((l) => l.completed || l.excused).map((l) => l.habit_id));
      setPending(
        habits.filter(
          (h) =>
            toLocalISODate(new Date(h.created_at)) <= yesterday &&
            isScheduledOn(h, yesterday) &&
            !doneIds.has(h.id)
        )
      );
    }
    load();
  }, [yesterday, dismissed]);

  async function markDone(habit: Habit) {
    const res = await fetch(`/api/habits/${habit.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: yesterday, completed: true }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      return;
    }
    setPending((prev) => prev?.filter((h) => h.id !== habit.id) ?? null);
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(yesterday), "1");
    } catch {
      // Not persisted, but still dismissed for this session.
    }
  }

  if (dismissed || pending === null || pending.length === 0) return null;

  return (
    <Card className="gap-2 border-warning/30 bg-accent-muted-bg/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-text-primary">
          <History className="size-4 text-warning" />
          {pending.length} habit{pending.length === 1 ? "" : "s"} unlogged from yesterday
        </p>
        <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Dismiss">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5 pl-5">
        {pending.map((habit) => (
          <label key={habit.id} className="flex items-center gap-2 text-sm text-text-secondary">
            <Checkbox onCheckedChange={() => markDone(habit)} />
            {habit.name}
          </label>
        ))}
      </div>
    </Card>
  );
}
