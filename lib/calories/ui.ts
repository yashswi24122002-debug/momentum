import type { CalorieDataSource, CalorieConfidence, MealType } from "@/lib/types/calories";
import type { StatusTone } from "@/components/shared/status-badge";

// PRD §3/§6 label conventions — every nutrition value must show its source
// and confidence, never presented as more exact than it is.
export const SOURCE_LABELS: Record<CalorieDataSource, string> = {
  personal_food: "Personal",
  package_label: "Label verified",
  recipe: "Personal recipe",
  ifct_reference: "Reference estimate",
  open_food_facts: "Community/label data",
  ai_photo: "AI estimate — review needed",
  ai_label_ocr: "AI estimate — review needed",
};

export const CONFIDENCE_TONES: Record<CalorieConfidence, StatusTone> = {
  verified: "success",
  reference: "info",
  estimated: "warning",
};

export const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};
