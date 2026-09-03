"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, Trash2, Pencil, GripVertical, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CalorieRing } from "@/components/calories/calorie-ring";
import { SettingsForm } from "@/components/calories/settings-form";
import { fetcher } from "@/lib/swr-fetcher";
import { SOURCE_LABELS, CONFIDENCE_TONES, MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from "@/lib/calories/ui";
import { todayLocalISODate, addDays } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { FoodLogWithItems, FoodLogItem, NutritionTotals, CalorieSettings, MealType } from "@/lib/types/calories";

type EditForm = {
  quantity: string;
  serving_label: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};

function toEditForm(item: FoodLogItem): EditForm {
  return {
    quantity: String(item.quantity),
    serving_label: item.serving_label,
    kcal: String(item.kcal),
    protein_g: String(item.protein_g),
    carbs_g: String(item.carbs_g),
    fat_g: String(item.fat_g),
  };
}

type MealGroup = { meal_type: string; logs: FoodLogWithItems[]; totals: NutritionTotals };
type DashboardData = {
  date: string;
  settings: CalorieSettings | null;
  consumed: NutritionTotals;
  remaining: number | null;
  mealGroups: MealGroup[];
};

function DroppableMealSection({ mealType, children }: { mealType: MealType; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: mealType });
  return (
    <div
      ref={setNodeRef}
      className={cn("space-y-2 rounded-xl p-1 transition-colors", isOver && "bg-accent-muted-bg/50 outline-2 outline-dashed outline-primary/40")}
    >
      {children}
    </div>
  );
}

function DraggableLogCard({
  log,
  onEditItem,
  onDelete,
}: {
  log: FoodLogWithItems;
  onEditItem: (logId: string, item: FoodLogItem) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: log.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  return (
    <Card ref={setNodeRef} style={style} className="gap-2 border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-text-muted active:cursor-grabbing"
          aria-label="Drag to move to a different meal"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 space-y-2">
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
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-text-muted hover:text-text-primary"
                onClick={() => onEditItem(log.id, item)}
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-text-muted hover:bg-danger/10 hover:text-danger"
          onClick={() => onDelete(log.id)}
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

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
  const { data, mutate } = useSWR<DashboardData>(`/api/calories/dashboard?date=${date}`, fetcher);
  const [editTarget, setEditTarget] = useState<{ logId: string; item: FoodLogItem } | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleDeleteLog(id: string) {
    const res = await fetch(`/api/calories/logs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    mutate((prev) => {
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
    }, { revalidate: false });
    toast.success("Removed.");
  }

  function sumTotals(items: FoodLogItem[]): NutritionTotals {
    return {
      kcal: items.reduce((s, i) => s + i.kcal, 0),
      protein_g: Math.round(items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10,
      carbs_g: Math.round(items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10,
      fat_g: Math.round(items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10,
    };
  }

  function addTotals(a: NutritionTotals, b: NutritionTotals, sign: 1 | -1): NutritionTotals {
    return {
      kcal: a.kcal + sign * b.kcal,
      protein_g: Math.round((a.protein_g + sign * b.protein_g) * 10) / 10,
      carbs_g: Math.round((a.carbs_g + sign * b.carbs_g) * 10) / 10,
      fat_g: Math.round((a.fat_g + sign * b.fat_g) * 10) / 10,
    };
  }

  // Dragging a logged entry onto a different meal-type section moves it
  // there — same PATCH the meal-type "moves" already used elsewhere, just
  // triggered by drop instead of a form. Sections for meal types with no
  // entries yet don't appear in mealGroups at all, so a drop onto one
  // creates the group locally instead of assuming it's already there.
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !data) return;
    const logId = String(active.id);
    const newMealType = over.id as MealType;

    const log = data.mealGroups.flatMap((g) => g.logs).find((l) => l.id === logId);
    if (!log || log.meal_type === newMealType) return;
    const oldMealType = log.meal_type;
    const itemTotals = sumTotals(log.food_log_items ?? []);
    const movedLog = { ...log, meal_type: newMealType };

    mutate((prev) => {
      if (!prev) return prev;
      const withoutLog = prev.mealGroups
        .map((g) => (g.meal_type === oldMealType ? { ...g, logs: g.logs.filter((l) => l.id !== logId), totals: addTotals(g.totals, itemTotals, -1) } : g))
        .filter((g) => g.logs.length > 0);

      const targetExists = withoutLog.some((g) => g.meal_type === newMealType);
      const mealGroups = targetExists
        ? withoutLog.map((g) => (g.meal_type === newMealType ? { ...g, logs: [...g.logs, movedLog], totals: addTotals(g.totals, itemTotals, 1) } : g))
        : [...withoutLog, { meal_type: newMealType, logs: [movedLog], totals: itemTotals }];

      return { ...prev, mealGroups };
    }, { revalidate: false });

    const res = await fetch(`/api/calories/logs/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_type: newMealType }),
    });
    if (!res.ok) {
      toast.error("Couldn't move that — try again.");
      mutate();
      return;
    }
    toast.success(`Moved to ${MEAL_TYPE_LABELS[newMealType]}.`);
  }

  function openEdit(logId: string, item: FoodLogItem) {
    setEditTarget({ logId, item });
    setEditForm(toEditForm(item));
  }

  async function handleSaveEdit() {
    if (!editTarget || !editForm) return;
    const { logId, item } = editTarget;

    const quantity = Number(editForm.quantity);
    const kcal = Number(editForm.kcal);
    const protein_g = Number(editForm.protein_g);
    const carbs_g = Number(editForm.carbs_g);
    const fat_g = Number(editForm.fat_g);
    if (!editForm.serving_label.trim() || !(quantity > 0) || [kcal, protein_g, carbs_g, fat_g].some(Number.isNaN)) {
      toast.error("Enter valid numbers for quantity and every macro.");
      return;
    }

    setSavingEdit(true);
    const res = await fetch(`/api/calories/logs/${logId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, serving_label: editForm.serving_label.trim(), kcal, protein_g, carbs_g, fat_g }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      return;
    }
    const { item: updated } = (await res.json()) as { item: FoodLogItem };

    mutate((prev) => {
      if (!prev) return prev;
      const kcalDelta = updated.kcal - item.kcal;
      const proteinDelta = updated.protein_g - item.protein_g;
      const carbsDelta = updated.carbs_g - item.carbs_g;
      const fatDelta = updated.fat_g - item.fat_g;

      const mealGroups = prev.mealGroups.map((g) => {
        if (!g.logs.some((l) => l.id === logId)) return g;
        return {
          ...g,
          totals: {
            kcal: g.totals.kcal + kcalDelta,
            protein_g: Math.round((g.totals.protein_g + proteinDelta) * 10) / 10,
            carbs_g: Math.round((g.totals.carbs_g + carbsDelta) * 10) / 10,
            fat_g: Math.round((g.totals.fat_g + fatDelta) * 10) / 10,
          },
          logs: g.logs.map((l) =>
            l.id === logId
              ? { ...l, food_log_items: (l.food_log_items ?? []).map((i) => (i.id === updated.id ? updated : i)) }
              : l
          ),
        };
      });

      return {
        ...prev,
        mealGroups,
        consumed: {
          kcal: prev.consumed.kcal + kcalDelta,
          protein_g: Math.round((prev.consumed.protein_g + proteinDelta) * 10) / 10,
          carbs_g: Math.round((prev.consumed.carbs_g + carbsDelta) * 10) / 10,
          fat_g: Math.round((prev.consumed.fat_g + fatDelta) * 10) / 10,
        },
        remaining: prev.remaining !== null ? prev.remaining - kcalDelta : null,
      };
    }, { revalidate: false });
    setEditTarget(null);
    setEditForm(null);
    toast.success("Updated.");
  }

  if (data === undefined) {
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
        <SettingsForm onSaved={(settings) => mutate((prev) => (prev ? { ...prev, settings } : prev), { revalidate: false })} />
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Drag the grip on any entry to move it into a different meal.</p>
            {MEAL_TYPE_ORDER.map((mealType) => {
              const group = data.mealGroups.find((g) => g.meal_type === mealType);
              return (
                <div key={mealType} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-text-secondary">{MEAL_TYPE_LABELS[mealType]}</h2>
                    {group && <span className="text-xs text-text-muted">{group.totals.kcal} kcal</span>}
                  </div>
                  <DroppableMealSection mealType={mealType}>
                    {group ? (
                      group.logs.map((log) => <DraggableLogCard key={log.id} log={log} onEditItem={openEdit} onDelete={handleDeleteLog} />)
                    ) : (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
                        Nothing here — drop an entry to move it to {MEAL_TYPE_LABELS[mealType]}.
                      </p>
                    )}
                  </DroppableMealSection>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.item.display_name}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((f) => f && { ...f, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Serving</Label>
                  <Input
                    value={editForm.serving_label}
                    onChange={(e) => setEditForm((f) => f && { ...f, serving_label: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kcal</Label>
                  <Input type="number" value={editForm.kcal} onChange={(e) => setEditForm((f) => f && { ...f, kcal: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Protein g</Label>
                  <Input
                    type="number"
                    value={editForm.protein_g}
                    onChange={(e) => setEditForm((f) => f && { ...f, protein_g: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Carbs g</Label>
                  <Input
                    type="number"
                    value={editForm.carbs_g}
                    onChange={(e) => setEditForm((f) => f && { ...f, carbs_g: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fat g</Label>
                  <Input type="number" value={editForm.fat_g} onChange={(e) => setEditForm((f) => f && { ...f, fat_g: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
