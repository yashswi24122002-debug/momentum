"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefHat, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LogPortionDialog } from "@/components/calories/log-portion-dialog";
import type { RecipeWithIngredients, FoodLogWithItems } from "@/lib/types/calories";

type RecipeWithNutrition = RecipeWithIngredients & {
  total: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  perServing: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
};

export function RecipeQuickLog({ logDate, onLogged }: { logDate?: string; onLogged: (log: FoodLogWithItems) => void }) {
  const [recipes, setRecipes] = useState<RecipeWithNutrition[] | null>(null);
  const [selected, setSelected] = useState<RecipeWithNutrition | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/calories/recipes");
      const json = await res.json();
      setRecipes(json.recipes ?? []);
    }
    load();
  }, []);

  if (recipes === null) return null;

  if (recipes.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState icon={ChefHat} title="No recipes yet" description="Save a recurring home dish as a recipe to log it in two taps next time." />
        <Button variant="outline" size="sm" render={<Link href="/calories/recipes" />} nativeButton={false}>
          <Plus className="size-3.5" />
          Create a recipe
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recipes.map((recipe) => (
        <button
          key={recipe.id}
          type="button"
          onClick={() => setSelected(recipe)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-left hover:border-primary/50"
        >
          <div>
            <p className="text-sm text-text-primary">{recipe.name}</p>
            <p className="text-xs text-text-muted">
              {recipe.perServing.kcal} kcal / serving · {recipe.yield_servings} servings
            </p>
          </div>
          <Plus className="size-4 shrink-0 text-text-muted" />
        </button>
      ))}

      <LogPortionDialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        recipe={selected}
        logDate={logDate}
        onLogged={(log) => {
          setSelected(null);
          onLogged(log);
        }}
      />
    </div>
  );
}
