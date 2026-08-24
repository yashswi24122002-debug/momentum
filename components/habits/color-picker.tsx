"use client";

import { cn } from "@/lib/utils";

export const HABIT_COLOR_PRESETS = [
  "#10b981",
  "#38bdf8",
  "#f59e0b",
  "#ef4444",
  "#a78bfa",
  "#f472b6",
  "#facc15",
  "#34d399",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        title="Default"
        className={cn(
          "size-5 shrink-0 rounded-full border-2 bg-surface-hover",
          value === null ? "border-primary" : "border-transparent"
        )}
        aria-label="Default color"
      />
      {HABIT_COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={cn(
            "size-5 shrink-0 rounded-full border-2",
            value === color ? "border-text-primary" : "border-transparent"
          )}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  );
}
