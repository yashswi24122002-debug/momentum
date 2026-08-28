export type CalorieDataSource =
  | "ifct_reference"
  | "open_food_facts"
  | "package_label"
  | "ai_photo"
  | "ai_label_ocr"
  | "personal_food"
  | "recipe";

export type CalorieConfidence = "verified" | "reference" | "estimated";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export type CalorieSettings = {
  id: string;
  daily_calorie_goal: number;
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
  timezone: string;
};

export type FoodServing = {
  id: string;
  food_id: string;
  label: string;
  grams: number;
  sort_order: number;
};

export type Food = {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  is_indian_food: boolean;
  is_personal: boolean;
  default_serving_name: string | null;
  default_serving_g: number | null;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fibre_g_per_100g: number | null;
  sugar_g_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  source: CalorieDataSource;
  source_reference: string | null;
  confidence: CalorieConfidence;
  created_at: string;
};

export type FoodWithServings = Food & { food_servings: FoodServing[] };

export type Recipe = {
  id: string;
  name: string;
  notes: string | null;
  yield_servings: number;
  total_cooked_weight_g: number | null;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  food_id: string;
  quantity_g: number;
  sort_order: number;
};

export type RecipeIngredientWithFood = RecipeIngredient & { foods: Pick<Food, "id" | "name"> };
export type RecipeWithIngredients = Recipe & { recipe_ingredients: RecipeIngredientWithFood[] };

export type FoodLog = {
  id: string;
  logged_on: string;
  meal_type: MealType;
  meal_label: string | null;
  logged_at: string;
  source: CalorieDataSource;
  photo_url: string | null;
  barcode: string | null;
  notes: string | null;
};

export type FoodLogItem = {
  id: string;
  food_log_id: string;
  food_id: string | null;
  recipe_id: string | null;
  display_name: string;
  quantity: number;
  serving_label: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: CalorieDataSource;
  confidence: CalorieConfidence;
  ai_confidence: number | null;
};

export type FoodLogWithItems = FoodLog & { food_log_items: FoodLogItem[] };

export type FoodFavourite = {
  id: string;
  food_id: string | null;
  recipe_id: string | null;
  created_at: string;
};

export type FoodFavouriteWithDetails = FoodFavourite & {
  foods: Pick<Food, "id" | "name" | "default_serving_name" | "default_serving_g" | "kcal_per_100g"> | null;
  recipes: Pick<Recipe, "id" | "name" | "yield_servings"> | null;
};

/** Nutrition totals, always at whole-kcal/one-decimal-macro precision per the PRD's "no false precision" rule. */
export type NutritionTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
