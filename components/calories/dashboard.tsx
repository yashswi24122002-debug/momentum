"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CalorieRing } from "@/components/calories/calorie-ring";
import { SettingsForm } from "@/components/calories/settings-form";
import { SOURCE_LABELS, CONFIDENCE_TONES, MEAL_TYPE_LABELS } from "@/lib/calories/ui";
import { todayLocalISODate, addDays } from "@/lib/date";
import type { FoodLogWithItems, NutritionTotals, CalorieSettings } from "@/lib/types/calories";

type MealGroup = { meal_type: string; logs: FoodLogWithItems[]; totals: NutritionTotals };
type DashboardData = {
  date: string;
  settings: CalorieSettings | null;
  consumed: NutritionTotals;
  remaining: number | null;
  mealGroups: MealGroup[];
};

function MacroBar({ label, value, goal }: { label: string; value: number; goal?: number | null }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted">
          {value}g{goal ? ` / ${goal}g` : ""}
        </span>
      </div>
      {goal ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function CaloriesDashboard() {
  const [date, setDate] = useState(todayLocalISODate());
  const [data, setData] = useState<DashboardData | null>(null);
  const [checkedSettings, setCheckedSettings] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/calories/dashboard?date=${date}`);
      const json = await res.json();
      setData(json);
      setCheckedSettings(true);
    }
    load();
  }, [date]);

  async function handleDeleteLog(id: string) {
    const res = await fetch(`/api/calories/logs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    setData((prev) => {
      if (!prev) return prev;
      const removedLog = prev.mealGroups.flatMap((g) => g.logs).find((l) => l.id === id);
      if (!removedLog) return prev;
      const removedItems = removedLog.food_log_items ?? [];
      const newMealGroups = prev.mealGroups
        .map((g) => (g.meal_type === removedLog.meal_type ? { ...g, logs: g.logs.filter((l) => l.id !== id) } : g))
        .filter((g) => g.logs.length > 0);
      return {
        ...prev,
        mealGroups: newMealGroups,
        consumed: {
          kcal: prev.consumed.kcal - removedItems.reduce((s, i) => s + i.kcal, 0),
          protein_g: Math.round((prev.consumed.protein_g - removedItems.reduce((s, i) => s + i.protein_g, 0)) * 10) / 10,
          carbs_g: Math.round((prev.consumed.carbs_g - removedItems.reduce((s, i) => s + i.carbs_g, 0)) * 10) / 10,
          fat_g: Math.round((prev.consumed.fat_g - removedItems.reduce((s, i) => s + i.fat_g, 0)) * 10) / 10,
        },
        remaining: prev.remaining !== null ? prev.remaining + removedItems.reduce((s, i) => s + i.kcal, 0) : null,
      };
    });
    toast.success("Removed.");
  }

  if (!checkedSettings || data === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data.settings) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-xl font-semibold text-text-primary">Calories</h1>
        <EmptyState icon={Flame} title="Set a daily calorie goal to get started" description="You can change this anytime in Settings." />
        <SettingsForm onSaved={(settings) => setData((prev) => (prev ? { ...prev, settings } : prev))} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Calories</h1>
        <Button size="sm" render={<Link href="/calories/log" />} nativeButton={false}>
          <Plus className="size-3.5" />
          Add Food
        </Button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm text-text-secondary">{date === todayLocalISODate() ? "Today" : date}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={date >= todayLocalISODate()}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Card className="items-center gap-4 border-border bg-surface p-5">
        <CalorieRing consumed={data.consumed.kcal} goal={data.settings.daily_calorie_goal} />
        <div className="grid w-full grid-cols-3 gap-3">
          <MacroBar label="Protein" value={data.consumed.protein_g} goal={data.settings.protein_goal_g} />
          <MacroBar label="Carbs" value={data.consumed.carbs_g} goal={data.settings.carbs_goal_g} />
          <MacroBar label="Fat" value={data.consumed.fat_g} goal={data.settings.fat_goal_g} />
        </div>
      </Card>

      {data.mealGroups.length === 0 ? (
        <EmptyState icon={Flame} title="Nothing logged yet" description="Tap Add Food to log your first meal for this day." />
      ) : (
        <div className="space-y-4">
          {data.mealGroups.map((group) => (
            <div key={group.meal_type} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-secondary">{MEAL_TYPE_LABELS[group.meal_type as keyof typeof MEAL_TYPE_LABELS]}</h2>
                <span className="text-xs text-text-muted">{group.totals.kcal} kcal</span>
              </div>
              <div className="space-y-2">
                {group.logs.map((log) => (
                  <Card key={log.id} className="gap-2 border-border bg-surface p-3">
                    {(log.food_log_items ?? []).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-text-primary">
                            {item.quantity} × {item.serving_label} {item.display_name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <StatusBadge label={SOURCE_LABELS[item.source]} tone={CONFIDENCE_TONES[item.confidence]} />
                            <span className="text-xs text-text-muted">
                              {item.kcal} kcal · P{item.protein_g} C{item.carbs_g} F{item.fat_g}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-text-muted hover:bg-danger/10 hover:text-danger"
                        onClick={() => handleDeleteLog(log.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
