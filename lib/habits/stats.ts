import { addDays, parseLocalISODate } from "@/lib/date";
import type { Habit, HabitLog } from "@/lib/types/habits";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type WeekTrendPoint = { weekStart: string; completionPct: number };
export type DayProductivityPoint = { date: string; completed: number };
export type HabitStreak = { habitId: string; habitName: string; current: number; longest: number };
export type HabitCompletionRate = { habitId: string; habitName: string; pct: number };
export type WeekdayRate = { weekday: string; pct: number };

function logsByHabit(logs: HabitLog[]): Map<string, HabitLog[]> {
  const map = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = map.get(log.habit_id) ?? [];
    list.push(log);
    map.set(log.habit_id, list);
  }
  return map;
}

/** Completion % per week over the trailing `weeks` weeks, ending on `today`. */
export function weeklyCompletionTrend(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  weeks = 12
): WeekTrendPoint[] {
  const completedByDate = new Map<string, number>();
  for (const log of logs) {
    if (log.completed) completedByDate.set(log.date, (completedByDate.get(log.date) ?? 0) + 1);
  }

  const points: WeekTrendPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = addDays(today, -7 * w);
    const weekStart = addDays(weekEnd, -6);
    let completed = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      completed += completedByDate.get(date) ?? 0;
    }
    const possible = habits.length * 7;
    points.push({
      weekStart,
      completionPct: possible === 0 ? 0 : Math.round((completed / possible) * 100),
    });
  }
  return points;
}

/** Total habits completed per day over the trailing `days` days. */
export function dailyProductivity(logs: HabitLog[], today: string, days = 30): DayProductivityPoint[] {
  const completedByDate = new Map<string, number>();
  for (const log of logs) {
    if (log.completed) completedByDate.set(log.date, (completedByDate.get(log.date) ?? 0) + 1);
  }

  const points: DayProductivityPoint[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = addDays(today, -d);
    points.push({ date, completed: completedByDate.get(date) ?? 0 });
  }
  return points;
}

/** Overall done vs. not-done across all habits for the trailing `days` days. */
export function doneNotDone(habits: Habit[], logs: HabitLog[], today: string, days = 30) {
  const done = logs.filter((l) => l.completed && l.date >= addDays(today, -(days - 1))).length;
  const possible = habits.length * days;
  return { done, notDone: Math.max(possible - done, 0) };
}

/** Per-habit current streak (consecutive completed days ending today/yesterday) and longest-ever streak. */
export function habitStreaks(habits: Habit[], logs: HabitLog[], today: string): HabitStreak[] {
  const byHabit = logsByHabit(logs);

  return habits.map((habit) => {
    const habitLogs = byHabit.get(habit.id) ?? [];
    const completedDates = new Set(habitLogs.filter((l) => l.completed).map((l) => l.date));

    // Current streak: walk backward from today; a missing/incomplete today
    // doesn't break a streak that ended yesterday (still "current" until the
    // day is over), so start from today but tolerate today being unlogged.
    let current = 0;
    let cursor = today;
    if (!completedDates.has(cursor)) {
      cursor = addDays(cursor, -1);
    }
    while (completedDates.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }

    // Longest streak ever: scan all completed dates in order.
    const sorted = Array.from(completedDates).sort();
    let longest = 0;
    let run = 0;
    let prevDate: string | null = null;
    for (const date of sorted) {
      if (prevDate && addDays(prevDate, 1) === date) {
        run++;
      } else {
        run = 1;
      }
      longest = Math.max(longest, run);
      prevDate = date;
    }

    return { habitId: habit.id, habitName: habit.name, current, longest: Math.max(longest, current) };
  });
}

/** Per-habit completion % over the trailing `days` days, for best/worst insight. */
export function habitCompletionRates(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  days = 30
): HabitCompletionRate[] {
  const byHabit = logsByHabit(logs);
  const since = addDays(today, -(days - 1));

  return habits.map((habit) => {
    const completed = (byHabit.get(habit.id) ?? []).filter((l) => l.completed && l.date >= since).length;
    return { habitId: habit.id, habitName: habit.name, pct: Math.round((completed / days) * 100) };
  });
}

/** Completion % by day of week over the trailing `days` days, for best/worst-day insight. */
export function weekdayCompletionRates(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  days = 84
): WeekdayRate[] {
  const since = addDays(today, -(days - 1));
  const completedByWeekday = new Array(7).fill(0);
  const weekdayOccurrences = new Array(7).fill(0);

  for (let d = 0; d < days; d++) {
    const date = addDays(since, d);
    const weekday = parseLocalISODate(date).getDay();
    weekdayOccurrences[weekday] += habits.length;
  }
  for (const log of logs) {
    if (log.completed && log.date >= since) {
      const weekday = parseLocalISODate(log.date).getDay();
      completedByWeekday[weekday]++;
    }
  }

  return WEEKDAY_LABELS.map((label, i) => ({
    weekday: label,
    pct: weekdayOccurrences[i] === 0 ? 0 : Math.round((completedByWeekday[i] / weekdayOccurrences[i]) * 100),
  }));
}
