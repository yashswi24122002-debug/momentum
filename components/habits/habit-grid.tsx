"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X, Snowflake, Plane } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { daysInMonth, toLocalISODate, todayLocalISODate, addDays } from "@/lib/date";
import { isScheduledOn } from "@/lib/habits/schedule";
import type { Habit, HabitLog } from "@/lib/types/habits";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

// Only the trailing week is editable from the grid — anything older is
// historical record. The daily checklist on /habits is still the primary
// way to log today.
const EDITABLE_WINDOW_DAYS = 7;

type CellState = { completed: boolean; excused: boolean; note: string | null };

export function HabitGrid() {
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [logsByKey, setLogsByKey] = useState<Map<string, CellState>>(new Map());
  const [reloadToken, setReloadToken] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveFrom, setLeaveFrom] = useState(todayLocalISODate());
  const [leaveTo, setLeaveTo] = useState(todayLocalISODate());
  const [leaveNote, setLeaveNote] = useState("Vacation");
  const [savingLeave, setSavingLeave] = useState(false);

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
      const map = new Map<string, CellState>();
      (logsJson.logs as HabitLog[] | undefined)?.forEach((log) => {
        map.set(`${log.habit_id}:${log.date}`, {
          completed: log.completed,
          excused: log.excused,
          note: log.note,
        });
      });
      setLogsByKey(map);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, cursor.month, reloadToken]);

  async function saveLeave() {
    if (leaveTo < leaveFrom) {
      toast.error("End date must be on or after the start date.");
      return;
    }
    setSavingLeave(true);
    const res = await fetch("/api/habits/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date_from: leaveFrom, date_to: leaveTo, note: leaveNote || null }),
    });
    setSavingLeave(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't mark that as leave — try again." }));
      toast.error(error);
      return;
    }
    setLeaveOpen(false);
    setReloadToken((t) => t + 1);
    toast.success("Marked as leave — those days won't break your streaks.");
  }

  async function toggleCell(habitId: string, date: string, current: CellState | undefined) {
    const key = `${habitId}:${date}`;
    const wasCompleted = current?.completed ?? false;
    setLogsByKey((prev) => new Map(prev).set(key, { completed: !wasCompleted, excused: false, note: current?.note ?? null }));

    const res = await fetch(`/api/habits/${habitId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: !wasCompleted }),
    });

    if (!res.ok) {
      setLogsByKey((prev) => new Map(prev).set(key, current ?? { completed: false, excused: false, note: null }));
      toast.error("Couldn't save that — try again.");
    }
  }

  if (habits === null) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const monthLabel = MONTH_FORMATTER.format(new Date(cursor.year, cursor.month, 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLeaveFrom(today);
            setLeaveTo(today);
            setLeaveNote("Vacation");
            setLeaveOpen(true);
          }}
        >
          <Plane className="size-3.5" />
          Mark leave
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
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: habit.color ?? "var(--brand)" }}
                      />
                      {habit.name}
                    </span>
                  </td>
                  {days.map((day) => {
                    const date = toLocalISODate(new Date(cursor.year, cursor.month, day));
                    const cell = logsByKey.get(`${habit.id}:${date}`);
                    const completed = cell?.completed ?? false;
                    const excused = cell?.excused ?? false;
                    // A day before the habit existed was never expected to
                    // have anything logged — without this it reads as a
                    // wall of "missed" crosses across the habit's entire
                    // pre-creation history, not just genuinely missed days.
                    const createdDate = toLocalISODate(new Date(habit.created_at));
                    const scheduled = isScheduledOn(habit, date) && date >= createdDate;
                    const editable = date >= earliestEditable && date <= today;
                    const future = date > today;

                    if (!scheduled) {
                      return (
                        <td
                          key={day}
                          className="border-b border-border p-1 text-center text-text-muted/40"
                          title={date < createdDate ? "Habit didn't exist yet" : "Not scheduled"}
                        >
                          ·
                        </td>
                      );
                    }

                    return (
                      <td key={day} className="border-b border-border p-1 text-center" title={cell?.note ?? undefined}>
                        {excused ? (
                          <Snowflake className="mx-auto size-3.5 text-info" />
                        ) : future ? (
                          <span className="text-text-muted">·</span>
                        ) : editable ? (
                          <button
                            type="button"
                            onClick={() => toggleCell(habit.id, date, cell)}
                            className="flex size-5 items-center justify-center rounded hover:bg-surface-hover"
                          >
                            {completed ? <Check className="size-3.5 text-primary" /> : <X className="size-3.5 text-danger" />}
                          </button>
                        ) : (
                          <span className="flex items-center justify-center">
                            {completed ? <Check className="size-3.5 text-primary" /> : <X className="size-3.5 text-danger" />}
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

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Every habit scheduled during this range is marked excused — none of them count as missed, so your
              streaks carry straight through.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="leave-from">From</Label>
                <Input id="leave-from" type="date" value={leaveFrom} max={today} onChange={(e) => setLeaveFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leave-to">To</Label>
                <Input id="leave-to" type="date" value={leaveTo} max={today} onChange={(e) => setLeaveTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-note">Note</Label>
              <Input id="leave-note" value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="Vacation" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={saveLeave} disabled={savingLeave}>
              {savingLeave ? "Saving…" : "Mark as leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
