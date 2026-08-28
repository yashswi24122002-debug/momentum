import type { NutritionTotals } from "@/lib/types/calories";

/** Per-100g nutrition (matching the `foods` table's *_per_100g columns), scaled to an actual gram quantity. Whole kcal, one-decimal macros — PRD §3 "no false precision." */
export function scaleNutrition(
  per100g: { kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number },
  grams: number
): NutritionTotals {
  const factor = grams / 100;
  return {
    kcal: Math.round(per100g.kcal_per_100g * factor),
    protein_g: Math.round(per100g.protein_g_per_100g * factor * 10) / 10,
    carbs_g: Math.round(per100g.carbs_g_per_100g * factor * 10) / 10,
    fat_g: Math.round(per100g.fat_g_per_100g * factor * 10) / 10,
  };
}

export function sumNutrition(items: NutritionTotals[]): NutritionTotals {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: Math.round((acc.protein_g + item.protein_g) * 10) / 10,
      carbs_g: Math.round((acc.carbs_g + item.carbs_g) * 10) / 10,
      fat_g: Math.round((acc.fat_g + item.fat_g) * 10) / 10,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}
