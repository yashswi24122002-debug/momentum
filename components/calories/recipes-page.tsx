"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChefHat, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { computeRecipeNutrition } from "@/lib/calories/recipe-nutrition";
import type { Food, RecipeWithIngredients } from "@/lib/types/calories";

type RecipeWithNutrition = RecipeWithIngredients & {
  total: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  perServing: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
};

type DraftIngredient = { food: Food; quantity_g: string };

export function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeWithNutrition[] | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [yieldServings, setYieldServings] = useState("4");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientResults, setIngredientResults] = useState<Food[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecipeWithNutrition | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadRecipes() {
    const res = await fetch("/api/calories/recipes");
    const json = await res.json();
    setRecipes(json.recipes ?? []);
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/calories/recipes");
      const json = await res.json();
      setRecipes(json.recipes ?? []);
    }
    load();
  }, []);

  useEffect(() => {
    const trimmed = ingredientQuery.trim();
    const timeout = setTimeout(async () => {
      if (!trimmed) {
        setIngredientResults([]);
        return;
      }
      const res = await fetch(`/api/calories/foods?q=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      setIngredientResults(json.foods ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [ingredientQuery]);

  function resetBuilder() {
    setName("");
    setNotes("");
    setYieldServings("4");
    setIngredients([]);
    setIngredientQuery("");
    setIngredientResults([]);
  }

  const previewTotals =
    ingredients.length > 0
      ? computeRecipeNutrition(
          ingredients.map((i) => ({ quantity_g: Number(i.quantity_g) || 0, food: i.food })),
          Number(yieldServings) || 1
        )
      : null;

  async function handleSaveRecipe() {
    if (!name.trim() || ingredients.length === 0) {
      toast.error("Name and at least one ingredient are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/calories/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        notes: notes.trim() || null,
        yield_servings: Number(yieldServings),
        ingredients: ingredients.map((i) => ({ food_id: i.food.id, quantity_g: Number(i.quantity_g) })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save that recipe — try again.");
      return;
    }
    resetBuilder();
    setBuilderOpen(false);
    toast.success("Recipe saved.");
    loadRecipes();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/calories/recipes/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    setRecipes((prev) => prev?.filter((r) => r.id !== deleteTarget.id) ?? null);
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  if (recipes === null) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Recipes</h1>
        <Button size="sm" onClick={() => setBuilderOpen(true)}>
          <Plus className="size-3.5" />
          New recipe
        </Button>
      </div>

      {recipes.length === 0 ? (
        <EmptyState icon={ChefHat} title="No recipes yet" description="Save a recurring home dish from its ingredients, then log a portion in two taps." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="gap-2 border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary">{recipe.name}</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-text-muted hover:bg-danger/10 hover:text-danger"
                  onClick={() => setDeleteTarget(recipe)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {recipe.notes && <p className="text-xs text-text-secondary">{recipe.notes}</p>}
              <p className="text-xs text-text-muted">
                {recipe.perServing.kcal} kcal / serving · {recipe.yield_servings} servings · {recipe.recipe_ingredients.length} ingredients
              </p>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open);
          if (!open) resetBuilder();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New recipe</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Yield (servings) *</Label>
              <Input type="number" min="0.5" step="0.5" value={yieldServings} onChange={(e) => setYieldServings(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Ingredients</Label>
              {ingredients.map((ing, index) => (
                <div key={`${ing.food.id}-${index}`} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-text-primary">{ing.food.name}</span>
                  <Input
                    type="number"
                    className="w-24"
                    value={ing.quantity_g}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((p, i) => (i === index ? { ...p, quantity_g: e.target.value } : p)))
                    }
                  />
                  <span className="text-xs text-text-muted">g</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove ingredient"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}

              <Input placeholder="Search a food to add…" value={ingredientQuery} onChange={(e) => setIngredientQuery(e.target.value)} />
              {ingredientResults.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                  {ingredientResults.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      className="block w-full rounded px-2 py-1 text-left text-sm text-text-primary hover:bg-surface-hover"
                      onClick={() => {
                        setIngredients((prev) => [...prev, { food, quantity_g: String(food.default_serving_g ?? 100) }]);
                        setIngredientQuery("");
                        setIngredientResults([]);
                      }}
                    >
                      {food.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {previewTotals && (
              <div className="rounded-lg bg-background p-3 text-sm text-text-secondary">
                Total: {previewTotals.total.kcal} kcal · Per serving: {previewTotals.perServing.kcal} kcal, P{previewTotals.perServing.protein_g}
                g C{previewTotals.perServing.carbs_g}g F{previewTotals.perServing.fat_g}g
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveRecipe} disabled={saving}>
              {saving ? "Saving…" : "Save recipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This can't be undone. Past diary entries logged from this recipe keep their snapshot nutrition regardless."
      />
    </div>
  );
}
