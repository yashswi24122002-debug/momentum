-- Calorie Tracker (08-Calorie-Tracker-PRD.md §9) — full schema for the 6th
-- tool. Meal photos reuse the existing private "media" bucket (already has
-- an authenticated-full-access storage.objects policy from migration
-- 20260827000000) under a "meal-photos/" path prefix, rather than
-- provisioning and policy-granting a brand new bucket for one photo type.

create type calorie_data_source as enum (
  'ifct_reference', 'open_food_facts', 'package_label',
  'ai_photo', 'ai_label_ocr', 'personal_food', 'recipe'
);
create type calorie_confidence as enum ('verified', 'reference', 'estimated');

create table calorie_settings (
  id uuid primary key default gen_random_uuid(),
  daily_calorie_goal int not null check (daily_calorie_goal between 500 and 10000),
  protein_goal_g numeric(7,1),
  carbs_goal_g numeric(7,1),
  fat_goal_g numeric(7,1),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  brand text,
  barcode text unique,
  category text,
  is_indian_food boolean not null default false,
  is_personal boolean not null default false,
  default_serving_name text,
  default_serving_g numeric(8,2),
  kcal_per_100g numeric(8,2) not null,
  protein_g_per_100g numeric(8,2) not null default 0,
  carbs_g_per_100g numeric(8,2) not null default 0,
  fat_g_per_100g numeric(8,2) not null default 0,
  fibre_g_per_100g numeric(8,2),
  sugar_g_per_100g numeric(8,2),
  sodium_mg_per_100g numeric(10,2),
  source calorie_data_source not null,
  source_reference text,
  source_payload jsonb,
  confidence calorie_confidence not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  label text not null,
  grams numeric(8,2) not null check (grams > 0),
  sort_order int not null default 0,
  unique(food_id, label)
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  yield_servings numeric(8,2) not null check (yield_servings > 0),
  total_cooked_weight_g numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid not null references foods(id),
  quantity_g numeric(10,2) not null check (quantity_g > 0),
  sort_order int not null default 0
);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  logged_on date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  meal_label text,
  logged_at timestamptz not null default now(),
  source calorie_data_source not null,
  photo_url text,
  barcode text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table food_log_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null references food_logs(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  display_name text not null,
  quantity numeric(8,2) not null check (quantity > 0),
  serving_label text not null,
  serving_g numeric(10,2) not null check (serving_g > 0),
  kcal numeric(10,2) not null,
  protein_g numeric(10,2) not null default 0,
  carbs_g numeric(10,2) not null default 0,
  fat_g numeric(10,2) not null default 0,
  fibre_g numeric(10,2),
  sugar_g numeric(10,2),
  sodium_mg numeric(10,2),
  source calorie_data_source not null,
  confidence calorie_confidence not null,
  ai_confidence numeric(4,3),
  source_snapshot jsonb,
  created_at timestamptz default now()
);

create table food_favourites (
  id uuid primary key default gen_random_uuid(),
  food_id uuid references foods(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  created_at timestamptz default now(),
  check (num_nonnulls(food_id, recipe_id) = 1)
);

create index food_logs_logged_on_idx on food_logs(logged_on);
create index food_log_items_food_log_id_idx on food_log_items(food_log_id);
create index foods_normalized_name_idx on foods(normalized_name);
create index foods_barcode_idx on foods(barcode);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'calorie_settings', 'foods', 'food_servings',
      'recipes', 'recipe_ingredients',
      'food_logs', 'food_log_items', 'food_favourites'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
