"use client";

import { ALL_WEEKDAYS, WEEKDAY_LETTERS, WEEKDAY_LABELS } from "@/lib/habits/schedule";
import { cn } from "@/lib/utils";

export function FrequencyPicker({
  value,
  onChange,
}: {
  value: number[] | null | undefined;
  onChange: (days: number[]) => void;
}) {
  // Defensive fallback: a habit fetched before the frequency_days column
  // existed (migration not yet applied) comes back with it undefined.
  const days = value && value.length > 0 ? value : ALL_WEEKDAYS;

  function toggle(day: number) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    if (next.length === 0) return; // a habit must apply to at least one day
    onChange(next);
  }

  return (
    <div className="flex gap-1">
      {ALL_WEEKDAYS.map((day) => {
        const active = days.includes(day);
        return (
          <button
            key={day}
            type="button"
            title={WEEKDAY_LABELS[day]}
            onClick={() => toggle(day)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-surface-hover text-text-muted hover:text-text-primary"
            )}
          >
            {WEEKDAY_LETTERS[day]}
          </button>
        );
      })}
    </div>
  );
}
