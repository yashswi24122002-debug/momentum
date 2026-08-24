import { addDays, parseLocalISODate } from "@/lib/date";
import { isScheduledOn, WEEKDAY_LABELS } from "@/lib/habits/schedule";
import type { Habit, HabitLog } from "@/lib/types/habits";

export type WeekTrendPoint = { weekStart: string; completionPct: number };
export type DayProductivityPoint = { date: string; completed: number };
export type HabitStreak = { habitId: string; habitName: string; current: number; longest: number };
export type HabitCompletionRate = { habitId: string; habitName: string; pct: number };
export type WeekdayRate = { weekday: string; pct: number };
export type CategoryRate = { category: string; pct: number; habitCount: number };
export type HeatmapCell = { date: string; weekIndex: number; weekday: number; pct: number; scheduledCount: number };
export type OverallStats = {
  totalHabits: number;
  todayPct: number;
  weekPct: number;
  longestActiveStreak: number;
  totalCheckins: number;
};

/** Per-habit index of completed/excused dates, precomputed once per stats call. */
type HabitIndex = { habit: Habit; completedDates: Set<string>; excusedDates: Set<string> };

function indexByHabit(habits: Habit[], logs: HabitLog[]): HabitIndex[] {
  const byHabit = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = byHabit.get(log.habit_id) ?? [];
    list.push(log);
    byHabit.set(log.habit_id, list);
  }
  return habits.map((habit) => {
    const habitLogs = byHabit.get(habit.id) ?? [];
    return {
      habit,
      completedDates: new Set(habitLogs.filter((l) => l.completed).map((l) => l.date)),
      excusedDates: new Set(habitLogs.filter((l) => l.excused).map((l) => l.date)),
    };
  });
}

/** A date "counts" toward a habit's denominator only if scheduled and not excused. */
function isExpected(idx: HabitIndex, date: string): boolean {
  return isScheduledOn(idx.habit, date) && !idx.excusedDates.has(date);
}

/** Completion % per week over the trailing `weeks` weeks, ending on `today`. Denominator is schedule-aware. */
export function weeklyCompletionTrend(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  weeks = 12
): WeekTrendPoint[] {
  const index = indexByHabit(habits, logs);
  const points: WeekTrendPoint[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = addDays(today, -7 * w);
    const weekStart = addDays(weekEnd, -6);
    let expected = 0;
    let completed = 0;
    for (const idx of index) {
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        if (!isExpected(idx, date)) continue;
        expected++;
        if (idx.completedDates.has(date)) completed++;
      }
    }
    points.push({
      weekStart,
      completionPct: expected === 0 ? 0 : Math.round((completed / expected) * 100),
    });
  }
  return points;
}

/** Total habits completed per day over the trailing `days` days — a raw count, not schedule-normalized. */
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

/** Overall done vs. not-done across all habits for the trailing `days` days. Denominator is schedule-aware. */
export function doneNotDone(habits: Habit[], logs: HabitLog[], today: string, days = 30) {
  const index = indexByHabit(habits, logs);
  const since = addDays(today, -(days - 1));
  let expected = 0;
  let done = 0;
  for (const idx of index) {
    let d = since;
    while (d <= today) {
      if (isExpected(idx, d)) {
        expected++;
        if (idx.completedDates.has(d)) done++;
      }
      d = addDays(d, 1);
    }
  }
  return { done, notDone: Math.max(expected - done, 0) };
}

const MAX_STREAK_LOOKBACK_DAYS = 3660; // ~10 years — a safety bound, not a real-world limit

/**
 * Per-habit current streak and longest-ever streak. A day only counts toward
 * a streak if the habit is scheduled on it; unscheduled and excused days are
 * transparent (they neither extend nor break a streak).
 */
export function habitStreaks(habits: Habit[], logs: HabitLog[], today: string): HabitStreak[] {
  const index = indexByHabit(habits, logs);

  return index.map(({ habit, completedDates, excusedDates }) => {
    const expected = (date: string) => isScheduledOn(habit, date) && !excusedDates.has(date);

    // Current streak: walk backward from today. An unscheduled/excused day is
    // skipped transparently; today specifically is also tolerated if unlogged
    // (the day isn't over yet), but only on this first step.
    let current = 0;
    let cursor = today;
    for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
      if (!expected(cursor)) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (completedDates.has(cursor)) {
        current++;
        cursor = addDays(cursor, -1);
        continue;
      }
      if (cursor === today) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }

    // Longest streak ever: scan chronologically from the earliest log we have.
    let longest = current;
    if (completedDates.size > 0 || excusedDates.size > 0) {
      const allDates = [...completedDates, ...excusedDates];
      const earliest = allDates.reduce((a, b) => (a < b ? a : b));
      let run = 0;
      let d = earliest;
      for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS && d <= today; i++) {
        if (expected(d)) {
          run = completedDates.has(d) ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
        d = addDays(d, 1);
      }
    }

    return { habitId: habit.id, habitName: habit.name, current, longest };
  });
}

/** Per-habit completion % over the trailing `days` days. Denominator is schedule-aware. */
export function habitCompletionRates(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  days = 30
): HabitCompletionRate[] {
  const index = indexByHabit(habits, logs);
  const since = addDays(today, -(days - 1));

  return index.map((idx) => {
    let expected = 0;
    let completed = 0;
    let d = since;
    while (d <= today) {
      if (isExpected(idx, d)) {
        expected++;
        if (idx.completedDates.has(d)) completed++;
      }
      d = addDays(d, 1);
    }
    return {
      habitId: idx.habit.id,
      habitName: idx.habit.name,
      pct: expected === 0 ? 0 : Math.round((completed / expected) * 100),
    };
  });
}

/** Completion % by day of week over the trailing `days` days. Denominator is schedule-aware. */
export function weekdayCompletionRates(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  days = 84
): WeekdayRate[] {
  const index = indexByHabit(habits, logs);
  const since = addDays(today, -(days - 1));
  const completedByWeekday = new Array(7).fill(0);
  const occurrences = new Array(7).fill(0);

  for (const idx of index) {
    let d = since;
    while (d <= today) {
      if (isExpected(idx, d)) {
        const weekday = parseLocalISODate(d).getDay();
        occurrences[weekday]++;
        if (idx.completedDates.has(d)) completedByWeekday[weekday]++;
      }
      d = addDays(d, 1);
    }
  }

  return WEEKDAY_LABELS.map((label, i) => ({
    weekday: label,
    pct: occurrences[i] === 0 ? 0 : Math.round((completedByWeekday[i] / occurrences[i]) * 100),
  }));
}

/** Completion % grouped by habit category over the trailing `days` days. Denominator is schedule-aware. */
export function completionByCategory(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
  days = 30
): CategoryRate[] {
  const since = addDays(today, -(days - 1));
  const index = indexByHabit(habits, logs);
  const groups = new Map<string, HabitIndex[]>();

  for (const idx of index) {
    const key = idx.habit.category?.trim() || "Uncategorized";
    const list = groups.get(key) ?? [];
    list.push(idx);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([category, groupIndex]) => {
      let expected = 0;
      let completed = 0;
      for (const idx of groupIndex) {
        let d = since;
        while (d <= today) {
          if (isExpected(idx, d)) {
            expected++;
            if (idx.completedDates.has(d)) completed++;
          }
          d = addDays(d, 1);
        }
      }
      return {
        category,
        pct: expected === 0 ? 0 : Math.round((completed / expected) * 100),
        habitCount: groupIndex.length,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/**
 * GitHub-contributions-style grid: one cell per day over the trailing
 * `weeks` weeks. `pct` is completed / scheduled among habits actually
 * scheduled that day (not excused) — `scheduledCount` lets the UI
 * distinguish "no habits scheduled" from "scheduled but missed."
 * Weeks run Monday-Sunday to match startOfWeekMonday elsewhere.
 */
export function contributionHeatmap(habits: Habit[], logs: HabitLog[], today: string, weeks = 16): HeatmapCell[] {
  const index = indexByHabit(habits, logs);
  const totalDays = weeks * 7;
  const start = addDays(today, -(totalDays - 1));
  const cells: HeatmapCell[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(start, i);
    const jsWeekday = parseLocalISODate(date).getDay(); // 0 = Sun
    const mondayFirstWeekday = jsWeekday === 0 ? 6 : jsWeekday - 1;

    let scheduledCount = 0;
    let completedCount = 0;
    for (const idx of index) {
      if (isExpected(idx, date)) {
        scheduledCount++;
        if (idx.completedDates.has(date)) completedCount++;
      }
    }

    cells.push({
      date,
      weekIndex: Math.floor(i / 7),
      weekday: mondayFirstWeekday,
      pct: scheduledCount === 0 ? 0 : completedCount / scheduledCount,
      scheduledCount,
    });
  }

  return cells;
}

/** Top-line stats for the dashboard header row. */
export function overallStats(habits: Habit[], logs: HabitLog[], today: string): OverallStats {
  const index = indexByHabit(habits, logs);
  const streaks = habitStreaks(habits, logs, today);

  const scheduledTodayIds = new Set(
    index.filter((idx) => isExpected(idx, today)).map((idx) => idx.habit.id)
  );
  const todayCompleted = logs.filter(
    (l) => l.completed && l.date === today && scheduledTodayIds.has(l.habit_id)
  ).length;

  const weekStart = addDays(today, -6);
  let weekExpected = 0;
  let weekCompleted = 0;
  for (const idx of index) {
    let d = weekStart;
    while (d <= today) {
      if (isExpected(idx, d)) {
        weekExpected++;
        if (idx.completedDates.has(d)) weekCompleted++;
      }
      d = addDays(d, 1);
    }
  }

  return {
    totalHabits: habits.length,
    todayPct: scheduledTodayIds.size === 0 ? 0 : Math.round((todayCompleted / scheduledTodayIds.size) * 100),
    weekPct: weekExpected === 0 ? 0 : Math.round((weekCompleted / weekExpected) * 100),
    longestActiveStreak: streaks.reduce((max, s) => Math.max(max, s.current), 0),
    totalCheckins: logs.filter((l) => l.completed).length,
  };
}

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365, 500, 1000];
