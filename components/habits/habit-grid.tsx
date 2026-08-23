"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { daysInMonth, toLocalISODate, todayLocalISODate, addDays } from "@/lib/date";
import type { Habit, HabitLog } from "@/lib/types/habits";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

// Only the trailing week is editable from the grid — anything older is
// historical record. The daily checklist on /habits is still the primary
// way to log today.
const EDITABLE_WINDOW_DAYS = 7;

export function HabitGrid() {
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [logsByKey, setLogsByKey] = useState<Map<string, boolean>>(new Map());

  const today = todayLocalISODate();
  const earliestEditable = addDays(today, -(EDITABLE_WINDOW_DAYS - 1));
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => i + 1),
    [totalDays]
  );

  useEffect(() => {
    async function load() {
      const from = toLocalISODate(new Date(cursor.year, cursor.month, 1));
      const to = toLocalISODate(new Date(cursor.year, cursor.month, totalDays));

      const [habitsRes, logsRes] = await Promise.all([
        habits ? Promise.resolve(null) : fetch("/api/habits"),
        fetch(`/api/habits/logs?from=${from}&to=${to}`),
      ]);

      if (habitsRes) {
        const json = await habitsRes.json();
        setHabits(json.habits ?? []);
      }

      const logsJson = await logsRes.json();
      const map = new Map<string, boolean>();
      (logsJson.logs as HabitLog[] | undefined)?.forEach((log) => {
        map.set(`${log.habit_id}:${log.date}`, log.completed);
      });
      setLogsByKey(map);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, cursor.month]);

  async function toggleCell(habitId: string, date: string, current: boolean) {
    const key = `${habitId}:${date}`;
    setLogsByKey((prev) => new Map(prev).set(key, !current));

    const res = await fetch(`/api/habits/${habitId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: !current }),
    });

    if (!res.ok) {
      setLogsByKey((prev) => new Map(prev).set(key, current));
      toast.error("Couldn't save that — try again.");
    }
  }

  if (habits === null) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const monthLabel = MONTH_FORMATTER.format(new Date(cursor.year, cursor.month, 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
          }
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium text-text-primary">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
          }
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {habits.length === 0 ? (
        <p className="text-sm text-text-secondary">Add habits to see them here.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-32 border-b border-border bg-surface p-2 text-left font-medium text-text-secondary">
                  Habit
                </th>
                {days.map((day) => {
                  const date = toLocalISODate(new Date(cursor.year, cursor.month, day));
                  const isToday = date === today;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "min-w-8 border-b border-border p-1 text-center font-medium text-text-muted",
                        isToday && "text-primary"
                      )}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit.id}>
                  <td className="sticky left-0 z-10 border-b border-border bg-surface p-2 text-text-primary">
                    {habit.name}
                  </td>
                  {days.map((day) => {
                    const date = toLocalISODate(new Date(cursor.year, cursor.month, day));
                    const completed = logsByKey.get(`${habit.id}:${date}`) ?? false;
                    const editable = date >= earliestEditable && date <= today;
                    const future = date > today;

                    return (
                      <td key={day} className="border-b border-border p-1 text-center">
                        {future ? (
                          <span className="text-text-muted">·</span>
                        ) : editable ? (
                          <button
                            type="button"
                            onClick={() => toggleCell(habit.id, date, completed)}
                            className={cn(
                              "flex size-5 items-center justify-center rounded",
                              completed ? "bg-accent-muted-bg text-primary" : "bg-transparent text-text-muted hover:bg-surface-hover"
                            )}
                          >
                            {completed ? <Check className="size-3.5" /> : <X className="size-3 opacity-30" />}
                          </button>
                        ) : (
                          <span className={completed ? "text-primary" : "text-text-muted"}>
                            {completed ? <Check className="mx-auto size-3.5" /> : "·"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
