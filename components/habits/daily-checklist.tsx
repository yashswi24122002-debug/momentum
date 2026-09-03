"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Settings2, CheckSquare, Snowflake, StickyNote, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { CatchUpBanner } from "@/components/habits/catch-up-banner";
import { fetcher } from "@/lib/swr-fetcher";
import { todayLocalISODate, addDays } from "@/lib/date";
import { isScheduledOn } from "@/lib/habits/schedule";
import { habitStreaks, STREAK_MILESTONES } from "@/lib/habits/stats";
import type { Habit, HabitLog } from "@/lib/types/habits";

const STREAK_LOOKBACK_DAYS = 500;

export function DailyChecklist() {
  const router = useRouter();
  const today = todayLocalISODate();

  // SWR caches both by key, so re-entering /habits after visiting another
  // tab shows the last-known state instantly instead of a loading flash,
  // then quietly revalidates in the background.
  const { data: habitsData } = useSWR<{ habits: Habit[] }>("/api/habits", fetcher);
  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: HabitLog[] }>(
    `/api/habits/logs?from=${today}&to=${today}`,
    fetcher
  );

  const habits = habitsData?.habits ?? null;
  const logsByHabitId = useMemo(
    () => new Map((logsData?.logs ?? []).map((log) => [log.habit_id, log])),
    [logsData]
  );

  const [noteHabit, setNoteHabit] = useState<Habit | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const scheduledHabits = (habits ?? []).filter((h) => isScheduledOn(h, today));

  async function checkStreakMilestone(habit: Habit) {
    const res = await fetch(`/api/habits/logs?from=${addDays(today, -STREAK_LOOKBACK_DAYS)}&to=${today}`);
    const json = await res.json();
    const logs: HabitLog[] = json.logs ?? [];
    const [streak] = habitStreaks([habit], logs, today);
    if (streak && STREAK_MILESTONES.includes(streak.current)) {
      toast.success(`${streak.current}-day streak on "${habit.name}"!`);
    }
  }

  function withLog(habit: Habit, patch: Partial<HabitLog>): HabitLog[] {
    const previous = logsByHabitId.get(habit.id);
    const nextLog: HabitLog = {
      ...(previous ?? { id: "", habit_id: habit.id, date: today, logged_at: "", excused: false, note: null, completed: false }),
      ...patch,
    };
    const rest = (logsData?.logs ?? []).filter((l) => l.habit_id !== habit.id);
    return [...rest, nextLog];
  }

  async function toggleComplete(habit: Habit) {
    const previous = logsData?.logs ?? [];
    const nextCompleted = !logsByHabitId.get(habit.id)?.completed;

    // Optimistic update — PRD acceptance criteria requires instant feedback.
    mutateLogs({ logs: withLog(habit, { completed: nextCompleted, excused: false }) }, { revalidate: false });

    const res = await fetch(`/api/habits/${habit.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, completed: nextCompleted }),
    });

    if (!res.ok) {
      mutateLogs({ logs: previous }, { revalidate: false });
      toast.error("Couldn't save that — try again.");
      return;
    }

    if (nextCompleted) checkStreakMilestone(habit);
  }

  async function toggleExcused(habit: Habit) {
    const previous = logsData?.logs ?? [];
    const nextExcused = !logsByHabitId.get(habit.id)?.excused;

    mutateLogs({ logs: withLog(habit, { excused: nextExcused, completed: false }) }, { revalidate: false });

    const res = await fetch(`/api/habits/${habit.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, excused: nextExcused }),
    });

    if (!res.ok) {
      mutateLogs({ logs: previous }, { revalidate: false });
      toast.error("Couldn't save that — try again.");
    } else if (nextExcused) {
      toast("Marked excused — today won't break your streak.");
    }
  }

  function openNoteDialog(habit: Habit) {
    setNoteHabit(habit);
    setNoteDraft(logsByHabitId.get(habit.id)?.note ?? "");
  }

  async function saveNote() {
    if (!noteHabit) return;
    const habit = noteHabit;
    const res = await fetch(`/api/habits/${habit.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, note: noteDraft || null }),
    });
    if (!res.ok) {
      toast.error("Couldn't save that note — try again.");
      return;
    }
    const { log } = await res.json();
    const rest = (logsData?.logs ?? []).filter((l) => l.habit_id !== habit.id);
    mutateLogs({ logs: [...rest, log] }, { revalidate: false });
    setNoteHabit(null);
  }

  // Keyboard shortcuts — single-user app, so a few power-user bindings pay
  // off disproportionately. Ignored while typing in a form field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return;

      if (e.key === "g") {
        router.push("/habits/grid");
      } else if (e.key === "d") {
        router.push("/habits/dashboard");
      } else if (e.key === "m") {
        router.push("/habits/manage");
      } else if (/^[1-9]$/.test(e.key)) {
        const habit = scheduledHabits[Number(e.key) - 1];
        if (habit) toggleComplete(habit);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledHabits, logsByHabitId]);

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

  const doneCount = scheduledHabits.filter((h) => logsByHabitId.get(h.id)?.completed).length;
  const isPerfectDay = scheduledHabits.length > 0 && doneCount === scheduledHabits.length;

  return (
    <div className="space-y-2">
      <CatchUpBanner />

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {doneCount} of {scheduledHabits.length} done today
        </p>
        <Button variant="ghost" size="sm" render={<Link href="/habits/manage" />} nativeButton={false}>
          <Settings2 className="size-4" />
          Manage
        </Button>
      </div>

      {isPerfectDay && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-muted-bg px-3 py-2 text-sm font-medium text-primary">
          <PartyPopper className="size-4" />
          Perfect day — everything scheduled is done!
        </div>
      )}

      {scheduledHabits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
          Nothing scheduled for today.
        </p>
      ) : (
        scheduledHabits.map((habit, i) => {
          const log = logsByHabitId.get(habit.id);
          const completed = log?.completed ?? false;
          const excused = log?.excused ?? false;
          const hasNote = Boolean(log?.note);

          return (
            <Card
              key={habit.id}
              className={`flex flex-row items-center gap-2 border-border p-3 ${excused ? "bg-background" : "bg-surface"}`}
            >
              <span className="w-4 shrink-0 text-center text-[10px] text-text-muted">
                {i < 9 ? i + 1 : ""}
              </span>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: habit.color ?? "var(--brand)" }}
              />
              <Checkbox
                id={`habit-${habit.id}`}
                checked={completed}
                disabled={excused}
                onCheckedChange={() => toggleComplete(habit)}
                className="size-5"
              />
              <label
                htmlFor={`habit-${habit.id}`}
                className={`flex-1 text-sm font-medium ${
                  excused
                    ? "text-text-muted italic"
                    : completed
                      ? "text-text-muted line-through"
                      : "text-text-primary"
                }`}
              >
                {habit.name}
                {excused && <span className="ml-1.5 font-normal">(excused)</span>}
              </label>
              {habit.category && (
                <span className="hidden text-xs text-text-muted sm:inline">{habit.category}</span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                className={hasNote ? "text-primary" : "text-text-muted"}
                onClick={() => openNoteDialog(habit)}
                aria-label="Note"
              >
                <StickyNote className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className={excused ? "text-info" : "text-text-muted"}
                onClick={() => toggleExcused(habit)}
                aria-label={excused ? "Remove excuse" : "Excuse today (won't break streak)"}
                title={excused ? "Remove excuse" : "Excuse today — won't break your streak"}
              >
                <Snowflake className="size-3.5" />
              </Button>
            </Card>
          );
        })
      )}

      <Dialog open={noteHabit !== null} onOpenChange={(open) => !open && setNoteHabit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note — {noteHabit?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Anything worth remembering about today?"
            rows={4}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={saveNote}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
