import { scaleNutrition, sumNutrition } from "@/lib/calories/nutrition";
import type { NutritionTotals } from "@/lib/types/calories";

type IngredientForCalc = {
  quantity_g: number;
  food: { kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number };
};

/** Recipe totals = sum of ingredient nutrition; per-serving = total / yield_servings. PRD §14: "recipe totals equal ingredient totals." */
export function computeRecipeNutrition(
  ingredients: IngredientForCalc[],
  yieldServings: number
): { total: NutritionTotals; perServing: NutritionTotals } {
  const total = sumNutrition(ingredients.map((i) => scaleNutrition(i.food, i.quantity_g)));
  const perServing = {
    kcal: Math.round(total.kcal / yieldServings),
    protein_g: Math.round((total.protein_g / yieldServings) * 10) / 10,
    carbs_g: Math.round((total.carbs_g / yieldServings) * 10) / 10,
    fat_g: Math.round((total.fat_g / yieldServings) * 10) / 10,
  };
  return { total, perServing };
}
