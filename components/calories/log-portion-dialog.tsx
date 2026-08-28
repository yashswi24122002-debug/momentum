"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scaleNutrition } from "@/lib/calories/nutrition";
import { MEAL_TYPE_ORDER, MEAL_TYPE_LABELS } from "@/lib/calories/ui";
import { todayLocalISODate } from "@/lib/date";
import type { FoodWithServings, RecipeWithIngredients, MealType, FoodLogWithItems } from "@/lib/types/calories";

const CUSTOM_GRAMS = "__grams__";

export function LogPortionDialog({
  open,
  onOpenChange,
  food,
  recipe,
  logDate,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: FoodWithServings | null;
  recipe?: (RecipeWithIngredients & { perServing: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } }) | null;
  logDate?: string;
  onLogged: (log: FoodLogWithItems) => void;
}) {
  const servings = food?.food_servings ?? [];
  const [servingChoice, setServingChoice] = useState(servings[0]?.label ?? CUSTOM_GRAMS);
  const [grams, setGrams] = useState(String(food?.default_serving_g ?? 100));
  const [quantity, setQuantity] = useState("1");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [saving, setSaving] = useState(false);

  const servingG = servingChoice === CUSTOM_GRAMS ? Number(grams) || 0 : servings.find((s) => s.label === servingChoice)?.grams ?? 0;
  const servingLabel = servingChoice === CUSTOM_GRAMS ? "g" : servingChoice;
  const qty = Number(quantity) || 0;

  const preview = food
    ? scaleNutrition(food, servingG * qty)
    : recipe
      ? {
          kcal: Math.round(recipe.perServing.kcal * qty),
          protein_g: Math.round(recipe.perServing.protein_g * qty * 10) / 10,
          carbs_g: Math.round(recipe.perServing.carbs_g * qty * 10) / 10,
          fat_g: Math.round(recipe.perServing.fat_g * qty * 10) / 10,
        }
      : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  async function handleLog() {
    if (qty <= 0 || (food && servingG <= 0)) {
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
        source: food ? food.source : "recipe",
        items: [
          food
            ? {
                food_id: food.id,
                display_name: food.name,
                quantity: qty,
                serving_label: servingLabel === "g" ? "g" : servingLabel,
                serving_g: servingChoice === CUSTOM_GRAMS ? servingG : servingG,
                source: food.source,
                confidence: food.confidence,
              }
            : {
                recipe_id: recipe?.id,
                display_name: recipe?.name,
                quantity: qty,
                serving_label: "serving",
                serving_g: 1,
                source: "recipe",
                confidence: "verified",
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
          <DialogTitle>{food?.name ?? recipe?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="0" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            {food && (
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
                    <SelectItem value={CUSTOM_GRAMS}>Custom grams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {recipe && (
              <div className="flex items-end pb-1.5 text-xs text-text-muted">servings of this recipe</div>
            )}
          </div>

          {food && servingChoice === CUSTOM_GRAMS && (
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
