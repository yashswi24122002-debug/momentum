"use client";

import { useMemo } from "react";
import type { HeatmapCell } from "@/lib/habits/stats";

const WEEKDAY_ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short" });

function intensityClass(pct: number): string {
  if (pct <= 0) return "bg-surface-hover";
  if (pct < 0.34) return "bg-primary/25";
  if (pct < 0.67) return "bg-primary/55";
  if (pct < 1) return "bg-primary/80";
  return "bg-primary";
}

export function ContributionHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const weekCount = useMemo(() => Math.max(...cells.map((c) => c.weekIndex)) + 1, [cells]);

  const grid = useMemo(() => {
    const byWeek: (HeatmapCell | undefined)[][] = Array.from({ length: weekCount }, () =>
      new Array(7).fill(undefined)
    );
    for (const cell of cells) {
      byWeek[cell.weekIndex][cell.weekday] = cell;
    }
    return byWeek;
  }, [cells, weekCount]);

  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = "";
    grid.forEach((week, weekIndex) => {
      const firstDay = week.find(Boolean);
      if (!firstDay) return;
      const month = MONTH_FORMATTER.format(new Date(firstDay.date));
      if (month !== lastMonth) {
        labels.push({ weekIndex, label: month });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        <div className="ml-6 flex gap-1">
          {grid.map((_, weekIndex) => {
            const match = monthLabels.find((m) => m.weekIndex === weekIndex);
            return (
              <div key={weekIndex} className="w-3 text-[10px] text-text-muted">
                {match?.label ?? ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1">
            {WEEKDAY_ROW_LABELS.map((label, i) => (
              <div key={i} className="flex h-3 w-5 items-center text-[9px] text-text-muted">
                {label}
              </div>
            ))}
          </div>
          {grid.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((cell, weekday) => (
                <div
                  key={weekday}
                  title={cell ? `${cell.date}: ${Math.round(cell.pct * 100)}%` : undefined}
                  className={`size-3 rounded-sm ${cell ? intensityClass(cell.pct) : "bg-transparent"}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
          <span>Less</span>
          <div className="size-3 rounded-sm bg-surface-hover" />
          <div className="size-3 rounded-sm bg-primary/25" />
          <div className="size-3 rounded-sm bg-primary/55" />
          <div className="size-3 rounded-sm bg-primary/80" />
          <div className="size-3 rounded-sm bg-primary" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
