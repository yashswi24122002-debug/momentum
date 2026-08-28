# Calorie Tracker — PRD

**Status:** Research and implementation plan  
**Owner:** Solo project (single user)  
**Platform:** Momentum PWA, mobile-first  
**Market focus:** Indian homemade, regional, and packaged food

## 1. Purpose

Build a low-friction food diary that shows a daily calorie goal, calories consumed, calories remaining, and protein/carbohydrate/fat progress. It must make Indian meals practical to log rather than treating every meal as a Western branded product.

Four ways to log food:

1. **Search / quick add:** verified Indian-food catalogue, personal foods, favourites, recents, and custom food.
2. **Barcode:** scan packaged-food barcodes, retrieve nutrition, then confirm servings.
3. **Photo:** take/upload a meal photo; Gemini creates an editable Indian-meal estimate.
4. **Recipe:** calculate a recurring home recipe from ingredients and log its portion.

Recipes are an intentional fourth path: a photo cannot reliably see oil/ghee, exact preparation, or portion weight in mixed Indian dishes.

## 2. Goals and Boundaries

### Goals

- Log a known/recent food in under 30 seconds.
- Support breakfast, lunch, dinner, snack, and a custom meal label.
- Prioritise Indian units: roti, katori, bowl, cup, piece, idli, dosa, ladle, tbsp, tsp, and grams.
- Show source and confidence for every nutrition value; never present an AI estimate as exact.
- Make user-confirmed foods and recipes the fastest path on subsequent days.
- Fit the current single-user, authenticated Supabase/PWA architecture.

### Out of scope for v1

- Medical, allergy, or therapeutic dietary advice; this is informational tracking only.
- Automatic photo/barcode logging without explicit review and save.
- Guaranteed precise restaurant/street-food or photo calorie counts.
- Exercise calories, wearable syncing, coaching, fasting, supplements, social/crowdsourced features, or public food submissions.

## 3. Product Principles

- **Confirm before log:** scanning and analysis produce a draft only.
- **Show uncertainty:** use `label verified`, `reference estimate`, `personal recipe`, or `AI estimate — review needed` labels.
- **No false precision:** whole kcal, one decimal macro values; show a range/low-confidence warning for uncertain photos.
- **Serve the meal:** household portions come first, grams remain available for precision.
- **Historic logs are immutable:** changing a food/recipe never changes prior diary nutrition.

## 4. Research and Product Decisions

| Need | Research finding | Product decision |
|---|---|---|
| India-specific base foods | ICMR–NIN’s *Indian Food Composition Tables 2017* is India’s core composition reference. Its values are mostly for raw, unfortified foods, so it is not a ready-made cooked-dish database. | Curate reviewed Indian foods/preparations with per-100g nutrition and source attribution. Confirm reuse rights before a bulk IFCT import. |
| Packaged-food lookup | Open Food Facts offers a product-by-barcode API and nutrition per 100g/per serving where present. Its records are community-contributed and Indian coverage will vary. | Use it as first lookup, cache successful normalized records, show its source, and never block manual label entry. |
| Indian food labels | FSSAI’s labelling rules require energy and macro nutrition information and serving quantity on applicable packages. | Barcode misses/incomplete data fall back to nutrition-label photo extraction or manual entry. |
| Meal photos | Gemini supports image input and structured output, but cannot reliably know hidden fats, recipe, or scale from one image. | Gemini returns editable dish components, grams, assumptions, and confidence. User review is mandatory. |
| PWA barcode capture | `html5-qrcode` supports camera/image scanning for retail formats (EAN/UPC/Code 128 and more), with iOS browser support noted from iOS 15.1+. | Use it in a dynamically loaded client component. Isolate it behind an adapter so `@zxing/browser` remains a replacement option. |

### Reference products

- **HealthifyMe:** borrow the India-first food database, diary, calorie budget, and macro presentation; avoid an ad/coaching-heavy experience.
- **MyFitnessPal:** borrow quick barcode lookup and clear serving adjustment.
- **Foodvisor:** borrow the unified photo/text/barcode flow, review-before-save, and saved-food pattern.

## 5. User Jobs and Success Signals

| User job | Feature response |
|---|---|
| “I ate a normal Indian meal.” | Search Indian foods, edit portions, or use photo as an editable starting point. |
| “I ate a packaged snack.” | Scan barcode, choose servings, confirm nutrition. |
| “I cook this frequently.” | Save a recipe, then log a portion in two taps. |
| “Am I on track?” | Today dashboard shows consumed, remaining, calorie ring, meal totals, and macro bars. |

v1 health checks: median save time under 30 seconds for recents/search and under 60 seconds for barcode/photo; 80% of entries use a structured path rather than generic custom calories; photo acceptance/portion-only-adjustment rate is measured before expanding the capability.

## 6. Data Strategy

Store values as kcal, protein_g, carbs_g, fat_g, fibre_g nullable, sugar_g nullable, and sodium_mg nullable. Persist the serving basis and source; never mix a label’s per-serving data with per-100g data without a confirmed gram conversion.

| Priority | Source | Intended use | UI label |
|---:|---|---|---|
| 1 | User-confirmed package label/manual food | Any product | Label verified / Personal |
| 2 | User recipe calculated from ingredients | Repeated home dishes | Personal recipe |
| 3 | Curated Indian catalogue, IFCT-linked source/recipe assumptions | Raw ingredients and standard preparations | Reference estimate |
| 4 | Open Food Facts | Branded packaged food | Community/label data |
| 5 | Gemini photo/label extraction | Fast draft/missing barcode data | AI estimate — review needed |

Initial catalogue: rice/atta/roti/paratha/bread/poha/upma/idli/dosa/millets; dals/chana/rajma/sprouts; dal, sabzi, curd, paneer, chicken/fish curries, egg dishes, sambar/rasam/biryani; khichdi, thepla, dhokla, vada, chaat, pakora, samosa, namkeen, chai, coffee. English names plus common transliterations (e.g. dal/daal, roti/chapati) are required.

**Data-governance gate:** IFCT is authoritative, but online availability alone does not confirm a redistribution licence. Obtain NIN permission/terms before importing the full table. Phase 1 can ship without a bulk IFCT import through user foods, recipes, barcode data, and a small permitted/reviewed seed set.

## 7. Flows

### Setup and daily diary

1. `/calories` shows onboarding until the user sets a required daily calorie goal and optional macro targets; default timezone is Asia/Kolkata.
2. The dashboard groups today’s items by meal and shows consumed/goal, remaining, and macros.
3. **Add food** opens a bottom sheet: Search, Barcode, Photo, Recipe.
4. Saving updates the page optimistically. Goals are manual in v1; do not auto-prescribe a calorie target.

### Search/quick add

Start with favourites and recents. Search then returns Indian catalogue and personal foods. User chooses a portion/unit, quantity and meal type; no result leads to a personal-food form.

### Barcode

Camera permission is requested only after pressing Scan. Image upload and manual code entry are always available. The server queries a cached, normalized Open Food Facts result. The review sheet displays product, brand, nutrition basis, serving, source label, quantity and meal type. Missing or incomplete records lead to nutrition-label scan/manual entry, never guessed values.

### Photo

One meal image is captured/uploaded. Gemini suggests components rather than one opaque total (e.g. 2 rotis + dal + sabzi), each with household portion, estimated grams, macros, confidence, and assumptions. The review surface lets the user remove/add/edit components and displays: “Photo estimates cannot see oil/ghee or the exact recipe. Review before saving.” Confidence below 0.6 receives a low-confidence state and recipe/manual suggestion.

### Recipe

User names the recipe, adds searchable/custom ingredients by weight, and enters final yield servings or cooked weight. The app calculates total and per-serving nutrition. Saving a recipe does not retroactively alter historic meal snapshots.

## 8. Pages and Navigation

| Route | Function |
|---|---|
| `/calories` | Today dashboard and diary |
| `/calories/log` | Add-food flow with Search, Barcode, Photo, Recipe tabs |
| `/calories/history` | Day/week history and calorie/macro trends |
| `/calories/foods` | Personal foods, favourites, recents, catalogue search |
| `/calories/recipes` | Recipe list and builder |
| `/calories/settings` | Goals, units, privacy/data controls |

Mobile: calorie ring, remaining value, and Add Food appear above the fold. Meal cards show kcal, macro preview, and source/estimate state. The existing bottom tab bar has five visible slots; make Calories primary only after an explicit overflow/More navigation decision—do not silently hide another module.

## 9. Data Model

Every `food_log_items` record is a nutrition snapshot.

```sql
create type calorie_data_source as enum (
  'ifct_reference', 'open_food_facts', 'package_label',
  'ai_photo', 'ai_label_ocr', 'personal_food', 'recipe'
);
create type calorie_confidence as enum ('verified', 'reference', 'estimated');

create table calorie_settings (
  id uuid primary key default gen_random_uuid(),
  daily_calorie_goal int not null check (daily_calorie_goal between 500 and 10000),
  protein_goal_g numeric(7,1), carbs_goal_g numeric(7,1), fat_goal_g numeric(7,1),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null, normalized_name text not null, brand text, barcode text unique,
  category text, is_indian_food boolean not null default false,
  is_personal boolean not null default false, default_serving_name text,
  default_serving_g numeric(8,2),
  kcal_per_100g numeric(8,2) not null,
  protein_g_per_100g numeric(8,2) not null default 0,
  carbs_g_per_100g numeric(8,2) not null default 0,
  fat_g_per_100g numeric(8,2) not null default 0,
  fibre_g_per_100g numeric(8,2), sugar_g_per_100g numeric(8,2), sodium_mg_per_100g numeric(10,2),
  source calorie_data_source not null, source_reference text, source_payload jsonb,
  confidence calorie_confidence not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  label text not null, grams numeric(8,2) not null check (grams > 0), sort_order int not null default 0,
  unique(food_id, label)
);

create table recipes (
  id uuid primary key default gen_random_uuid(), name text not null, notes text,
  yield_servings numeric(8,2) not null check (yield_servings > 0), total_cooked_weight_g numeric(10,2),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid not null references foods(id), quantity_g numeric(10,2) not null check (quantity_g > 0),
  sort_order int not null default 0
);

create table food_logs (
  id uuid primary key default gen_random_uuid(), logged_on date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  meal_label text, logged_at timestamptz not null default now(),
  source calorie_data_source not null, photo_url text, barcode text, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table food_log_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null references food_logs(id) on delete cascade,
  food_id uuid references foods(id) on delete set null, recipe_id uuid references recipes(id) on delete set null,
  display_name text not null, quantity numeric(8,2) not null check (quantity > 0),
  serving_label text not null, serving_g numeric(10,2) not null check (serving_g > 0),
  kcal numeric(10,2) not null, protein_g numeric(10,2) not null default 0,
  carbs_g numeric(10,2) not null default 0, fat_g numeric(10,2) not null default 0,
  fibre_g numeric(10,2), sugar_g numeric(10,2), sodium_mg numeric(10,2),
  source calorie_data_source not null, confidence calorie_confidence not null,
  ai_confidence numeric(4,3), source_snapshot jsonb, created_at timestamptz default now()
);
create table food_favourites (
  id uuid primary key default gen_random_uuid(),
  food_id uuid references foods(id) on delete cascade, recipe_id uuid references recipes(id) on delete cascade,
  created_at timestamptz default now(), check (num_nonnulls(food_id, recipe_id) = 1)
);
```

Index `food_logs(logged_on)`, `food_log_items(food_log_id)`, `foods(normalized_name)`, and `foods(barcode)`. Apply the existing authenticated-only RLS model. Meal photos belong in a private Supabase Storage bucket and are deleted when requested.

## 10. APIs

| Route | Method | Purpose |
|---|---|---|
| `/api/calories/settings` | GET/PATCH | Goals and units |
| `/api/calories/dashboard` | GET | Date-scoped totals, meal groups, remaining calories |
| `/api/calories/logs` | GET/POST | Fetch date range / create reviewed meal and immutable item snapshots |
| `/api/calories/logs/[id]` | PATCH/DELETE | Edit or remove meal |
| `/api/calories/foods` | GET/POST | Search/create foods |
| `/api/calories/foods/[id]` | PATCH/DELETE | Update/archive personal foods |
| `/api/calories/barcode/[code]` | GET | Cache then Open Food Facts lookup and normalization |
| `/api/calories/analyse-photo` | POST | Image to Gemini structured draft; never persists a log |
| `/api/calories/analyse-label` | POST | Nutrition-panel extraction draft; review required |
| `/api/calories/recipes` | GET/POST | List/create recipes and calculations |
| `/api/calories/recipes/[id]` | GET/PATCH/DELETE | Recipe detail/edit/delete |
| `/api/calories/history` | GET | Daily aggregates and macro trend |

External boundaries: `lib/integrations/open-food-facts.ts` handles User-Agent, timeout, fields, normalization, caching, and failures. `lib/ai/analyse-food.ts` owns prompts, image limits, Zod schema, response validation, and errors. Browser components never call external APIs directly.

## 11. AI Contract and Privacy

Photo inputs: one image, maximum 10 MB; resize/compress and strip unnecessary EXIF before transfer. Retain original only after the user saves the corresponding log; discard an abandoned analysis. Reject images with no recognizable food and offer manual search.

Required response shape:

```ts
{
  overallConfidence: number, // 0..1
  needsClarification: boolean,
  clarificationQuestion?: string,
  items: [{
    name: string, likelyIndianDish: boolean, portionLabel: string,
    estimatedGrams: number, kcal: number, proteinG: number, carbsG: number, fatG: number,
    confidence: number, assumptions: string[]
  }],
  warnings: string[]
}
```

Nothing persists until all components are rendered in editable fields and the user presses Save. AI images and diary data are sensitive: private bucket, authenticated API/RLS, minimal retention, delete control, no third-party analytics on images.

## 12. Libraries

| Area | Choice | Rationale |
|---|---|---|
| Barcode scanner | `html5-qrcode` | Camera and local-image barcode decoding, suitable for a browser PWA. Install only this scanner in v1. |
| Alternative scanner | `@zxing/browser` | Lower-level fallback if custom camera control or package maintenance makes replacement worthwhile. |
| Capture | Native file input (`accept="image/*"`, `capture="environment"`) | No additional package; upload fallback for camera failures. |
| AI | Existing `@google/genai` and Zod | Reuse the project’s provider and structured-output validation pattern; create an image-aware helper rather than forcing images through the text helper. |
| Data | Open Food Facts REST API + Supabase cache | Open first lookup; incomplete data is expected. |
| Charts | Existing Recharts | Reuse for history and macros. |

## 13. Delivery Plan

### Phase 0 — foundation

Confirm IFCT reuse approach, create a food-review/source template and household-serving standard, resolve the sixth item in the mobile navigation, then add migration/RLS/private-storage policy/types/nutrition calculation tests.

### Phase 1 — reliable MVP

Goals; daily dashboard; food search; personal foods; favourites/recents; meal CRUD; recipes; date history; macro/calorie totals. Release only when a full day of Indian food can be logged without camera/AI.

### Phase 2 — packaged food

Scanner adapter, permissions and fallbacks; Open Food Facts integration/cache; serving conversion; nutrition-label extraction. Release only when every lookup requires review and every miss has a quick manual route.

### Phase 3 — photo-assisted logging

Private image upload/preprocessing; Gemini component schema; review/confidence UI; test set of representative Indian meals. Release only with no auto-save and clear low-confidence handling.

### Phase 4 — insights

7/30-day charts, copy meal/day, CSV export, optional weight tracking, and private matching improvements based on user corrections.

## 14. Acceptance Criteria

- A user sets a daily calorie goal and sees consumed, remaining, and percentage for any selected local date.
- Foods can be created, edited, deleted, favourited, and relogged; prior diary nutrition never changes after source edits.
- Search supports Indian foods, personal foods, aliases, grams, and household portions.
- Recipe totals equal ingredient totals and historic recipe logs remain snapshots.
- Barcode supports camera, image upload, and manual code entry; missing/incomplete results never create a guessed log.
- Every barcode/photo result exposes source and confidence before saving.
- Photo output is component-level, editable, warns about oil/ghee/portion uncertainty, and safely handles invalid/no-food images.
- All aggregate dates follow the selected timezone; no UTC day-boundary errors.
- New tables use authenticated-only RLS; photos are private; external/AI failures leave a useful manual fallback and log an error.
- Screens follow the current mobile-first dark design system, including accessible controls and permission fallbacks.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Hidden oils/ghee or portions make photos inaccurate | Editable components, confidence/assumptions, recipe path, no auto-save. |
| Incomplete Indian barcode coverage | Cache confirmed foods, label scan/manual route, no coverage promises. |
| IFCT redistribution uncertainty | Confirm permission before import; retain attribution; don’t block core launch on it. |
| Browser camera differences | Feature detect and retain image-upload/manual fallbacks. |
| Gemini quota/invalid responses | Server-only integration, size limits, Zod validation/retry, search/recipe fallback. |

## 16. Sources

- [ICMR–NIN Indian Food Composition Tables 2017](https://www.nin.res.in/ebooks/IFCT2017.pdf) and [FAO catalogue entry](https://www.fao.org/food-composition/tables-and-databases/detail/%28country--date%29-title-9/en)
- [Open Food Facts product-by-barcode documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/products/get-product-by-code/) and [API overview](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- [FSSAI Labelling and Display Compendium](https://www.fssai.gov.in/upload/uploadfiles/files/Compendium_Labelling_Display_30_06_2022.pdf)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [`html5-qrcode`](https://www.npmjs.com/package/html5-qrcode) and [`@zxing/browser`](https://www.npmjs.com/package/%40zxing/browser)
- [HealthifyMe calorie tracker](https://www.healthifyme.com/track_calories/) and [Indian-food catalogue claim](https://www.healthifyme.com/amp/app/)
- [MyFitnessPal barcode feature](https://support.myfitnesspal.com/hc/en-us/articles/360032625951-What-are-the-features-of-MyFitnessPal-Premium) and [Foodvisor app capabilities](https://apps.apple.com/us/app/foodvisor-ai-calorie-counter/id1064020872?platform=ipad)
