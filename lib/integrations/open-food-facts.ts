// Open Food Facts product-by-barcode lookup (08-Calorie-Tracker-PRD.md §4/§10).
// Live-verified directly against the real API before wiring in: a known
// barcode (Nutella, 3017620422003) returns full nutriments; an unknown/
// invalid code returns status:0, which this treats as "not found," never
// as a guessed value. Indian coverage is community-contributed and will
// vary — that's an accepted PRD risk, not something to work around here.

const USER_AGENT = "Momentum - personal calorie tracker - contact yashswi2412@gmail.com";

export type NormalizedProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fibre_g_per_100g: number | null;
  sugar_g_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  serving_size_raw: string | null;
  source_payload: Record<string, unknown>;
};

export type BarcodeResult =
  | { found: true; product: NormalizedProduct }
  | { found: false; error?: string };

export async function fetchProductByBarcode(barcode: string): Promise<BarcodeResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,serving_size,nutriments,nutrition_data_per,status`,
      { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { found: false, error: `HTTP ${res.status}` };

    const json = await res.json();
    if (json.status !== 1 || !json.product) {
      return { found: false };
    }

    const p = json.product;
    const n = p.nutriments ?? {};
    const kcal = n["energy-kcal_100g"];
    const protein = n["proteins_100g"];
    const carbs = n["carbohydrates_100g"];
    const fat = n["fat_100g"];

    // PRD §7: "Missing or incomplete records lead to nutrition-label
    // scan/manual entry, never guessed values" — these four are the
    // minimum required to treat a record as usable at all.
    if (typeof kcal !== "number" || typeof protein !== "number" || typeof carbs !== "number" || typeof fat !== "number") {
      return { found: false, error: "Incomplete nutrition data" };
    }

    const product: NormalizedProduct = {
      barcode,
      name: p.product_name || "Unknown product",
      brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
      kcal_per_100g: kcal,
      protein_g_per_100g: protein,
      carbs_g_per_100g: carbs,
      fat_g_per_100g: fat,
      fibre_g_per_100g: typeof n["fiber_100g"] === "number" ? n["fiber_100g"] : null,
      sugar_g_per_100g: typeof n["sugars_100g"] === "number" ? n["sugars_100g"] : null,
      sodium_mg_per_100g: typeof n["sodium_100g"] === "number" ? Math.round(n["sodium_100g"] * 1000) : null,
      serving_size_raw: p.serving_size ?? null,
      source_payload: { product_name: p.product_name, brands: p.brands, nutrition_data_per: p.nutrition_data_per, nutriments: n },
    };

    return { found: true, product };
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Best-effort "250 g" / "30g" / "1 cup (240 ml)" → grams, for adding a real serving option alongside 100g. Returns null when unparseable. */
export function parseServingGrams(servingSizeRaw: string | null): number | null {
  if (!servingSizeRaw) return null;
  const match = servingSizeRaw.match(/([\d.]+)\s*g\b/i);
  if (!match) return null;
  const grams = Number(match[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}
