import { parseLocalISODate } from "@/lib/date";
import type { Habit } from "@/lib/types/habits";

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Whether `habit` is scheduled on the given local ISO date. Empty/missing frequency_days means every day. */
export function isScheduledOn(habit: Pick<Habit, "frequency_days">, dateISO: string): boolean {
  if (!habit.frequency_days || habit.frequency_days.length === 0) return true;
  return habit.frequency_days.includes(parseLocalISODate(dateISO).getDay());
}

export function isDaily(frequencyDays: number[]): boolean {
  return !frequencyDays || frequencyDays.length === 0 || frequencyDays.length === 7;
}

export function isValidFrequencyDays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => Number.isInteger(v) && v >= 0 && v <= 6)
  );
}

export function scheduleLabel(frequencyDays: number[]): string {
  if (isDaily(frequencyDays)) return "Daily";
  return [...frequencyDays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}
