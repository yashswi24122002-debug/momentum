"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scaleNutrition } from "@/lib/calories/nutrition";
import { MEAL_TYPE_ORDER, MEAL_TYPE_LABELS } from "@/lib/calories/ui";
import { todayLocalISODate } from "@/lib/date";
import { fetcher } from "@/lib/swr-fetcher";
import type { FoodWithServings, MealType, FoodLogWithItems } from "@/lib/types/calories";

type LastLogged = { quantity: number; serving_label: string; serving_g: number; meal_type: MealType | null } | null;
type LastLoggedResponse = { last: LastLogged; recentGrams: number[] };

const CUSTOM_GRAMS = "__grams__";
const GRAMS_PREFIX = "grams:";

export function LogPortionDialog({
  open,
  onOpenChange,
  food,
  logDate,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: FoodWithServings | null;
  logDate?: string;
  onLogged: (log: FoodLogWithItems) => void;
}) {
  const servings = food?.food_servings ?? [];
  const [servingChoice, setServingChoice] = useState(servings[0]?.label ?? CUSTOM_GRAMS);
  const [grams, setGrams] = useState(String(food?.default_serving_g ?? 100));
  const [quantity, setQuantity] = useState("1");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [saving, setSaving] = useState(false);

  // Defaults to whatever this user last logged for this exact food (e.g.
  // "250g" for banana shake every time, in the meal it's usually logged
  // under) instead of generic defaults — only needs to apply once per
  // food selection (the parent remounts this dialog via `key={food.id}`
  // on each new selection, so this naturally resets per food).
  const { data: lastLoggedData } = useSWR<LastLoggedResponse>(
    food ? `/api/calories/foods/${food.id}/last-logged` : null,
    fetcher
  );
  const [appliedLastLogged, setAppliedLastLogged] = useState(false);
  if (lastLoggedData?.last && !appliedLastLogged) {
    setAppliedLastLogged(true);
    const last = lastLoggedData.last;
    setQuantity(String(last.quantity));
    if (last.meal_type) setMealType(last.meal_type);
    const matchedServing = servings.find((s) => s.label === last.serving_label);
    if (matchedServing) {
      setServingChoice(matchedServing.label);
    } else {
      setServingChoice(`${GRAMS_PREFIX}${last.serving_g}`);
      setGrams(String(last.serving_g));
    }
  }

  // Every gram amount worth offering as a one-tap pick: the catalogue's
  // own default (labelled so, since it's not something the user chose
  // themselves) plus whatever distinct amounts this user has actually
  // logged for this food before — e.g. logged 70g once and 100g another
  // time, both show up here alongside the 150g default and Custom.
  const gramOptions = new Map<number, string>();
  if (food?.default_serving_g) gramOptions.set(food.default_serving_g, `${food.default_serving_g}g (default)`);
  for (const g of lastLoggedData?.recentGrams ?? []) {
    if (!gramOptions.has(g)) gramOptions.set(g, `${g}g`);
  }

  const servingG = servingChoice.startsWith(GRAMS_PREFIX)
    ? Number(servingChoice.slice(GRAMS_PREFIX.length)) || 0
    : servingChoice === CUSTOM_GRAMS
      ? Number(grams) || 0
      : servings.find((s) => s.label === servingChoice)?.grams ?? 0;
  const servingLabel = servingChoice.startsWith(GRAMS_PREFIX) || servingChoice === CUSTOM_GRAMS ? "g" : servingChoice;
  const qty = Number(quantity) || 0;

  const preview = food ? scaleNutrition(food, servingG * qty) : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  async function handleLog() {
    if (!food || qty <= 0 || servingG <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/calories/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logged_on: logDate ?? todayLocalISODate(),
        meal_type: mealType,
        source: food.source,
        items: [
          {
            food_id: food.id,
            display_name: food.name,
            quantity: qty,
            serving_label: servingLabel,
            serving_g: servingG,
            source: food.source,
            confidence: food.confidence,
          },
        ],
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't log that — try again." }));
      toast.error(error);
      return;
    }
    const { log } = await res.json();
    onLogged(log);
    toast.success("Logged.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{food?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="0" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Serving</Label>
              <Select value={servingChoice} onValueChange={(v) => v && setServingChoice(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {servings.map((s) => (
                    <SelectItem key={s.id} value={s.label}>
                      {s.label} ({s.grams}g)
                    </SelectItem>
                  ))}
                  {[...gramOptions.entries()].map(([g, label]) => (
                    <SelectItem key={g} value={`${GRAMS_PREFIX}${g}`}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_GRAMS}>Custom grams</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {servingChoice === CUSTOM_GRAMS && (
            <div className="space-y-1.5">
              <Label>Grams</Label>
              <Input type="number" min="0" value={grams} onChange={(e) => setGrams(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Meal</Label>
            <Select value={mealType} onValueChange={(v) => v && setMealType(v as MealType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPE_ORDER.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-background p-3 text-sm text-text-secondary">
            {preview.kcal} kcal · Protein {preview.protein_g}g · Carbs {preview.carbs_g}g · Fat {preview.fat_g}g
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleLog} disabled={saving}>
            {saving ? "Logging…" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
