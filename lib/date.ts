/**
 * All habit dates are plain calendar dates (Postgres `date`, no time
 * component) compared as local-timezone ISO strings end to end. Never use
 * `Date#toISOString()` for this — it converts to UTC first, which shifts the
 * date near local midnight (Habit Tracker PRD §6: "careful with timezone
 * handling — store and compare dates in a single consistent timezone").
 */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocalISODate(): string {
  return toLocalISODate(new Date());
}

/** Parses a `YYYY-MM-DD` string as a local-midnight Date (not UTC midnight). */
export function parseLocalISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Monday of the week containing `date`, as a local ISO date string. */
export function startOfWeekMonday(date: Date): string {
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return toLocalISODate(monday);
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalISODate(iso);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Last `n` months as "YYYY-MM" strings, oldest first, ending with the current month. */
export function lastNMonths(n: number, from: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
