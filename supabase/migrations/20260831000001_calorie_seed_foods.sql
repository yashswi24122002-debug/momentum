-- Small reviewed Indian-food seed set (08-Calorie-Tracker-PRD.md §6 data
-- governance gate: ship without a bulk IFCT import; a small permitted/
-- reviewed set is fine for Phase 1). Values below are aggregated from
-- several public nutrition-tracking sources (not a verbatim IFCT copy),
-- rounded sensibly — hence confidence 'reference', never 'verified'.
-- Expand this list over time; treat every row as a reasonable estimate,
-- not a lab-verified figure.

insert into foods (name, normalized_name, category, is_indian_food, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, source, source_reference, confidence, default_serving_name, default_serving_g) values
  ('Rice, cooked', 'rice cooked bhaat chawal', 'grains', true, 130, 2.7, 28.1, 0.3, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Roti / Chapati', 'roti chapati phulka', 'grains', true, 297, 7.9, 36.4, 8.6, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 roti', 40),
  ('Paratha, plain', 'paratha plain', 'grains', true, 283, 6.7, 37, 11.7, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 paratha', 60),
  ('Dal, home-style', 'dal daal lentil curry', 'legumes', true, 110, 7, 15, 2.5, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Rajma curry', 'rajma kidney bean curry', 'legumes', true, 140, 8, 18, 6, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Chana dal, cooked', 'chana dal chole gram', 'legumes', true, 164, 10.7, 27, 2.6, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Sambar', 'sambar', 'legumes', true, 100, 5, 16, 2, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 bowl', 200),
  ('Idli', 'idli', 'breakfast', true, 58, 1.9, 11.4, 0.5, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 idli', 40),
  ('Dosa, plain', 'dosa plain', 'breakfast', true, 168, 3.6, 30.2, 3.8, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 dosa', 80),
  ('Poha', 'poha flattened rice', 'breakfast', true, 148, 2.9, 30.1, 2.4, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 plate', 150),
  ('Upma', 'upma rava', 'breakfast', true, 112, 3, 19, 3.5, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 plate', 180),
  ('Khichdi', 'khichdi moong rice', 'grains', true, 120, 4, 20, 3, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 bowl', 200),
  ('Paneer', 'paneer cottage cheese', 'dairy', true, 265, 18, 1.2, 20, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 cube', 20),
  ('Curd, plain', 'curd dahi yogurt', 'dairy', true, 60, 3.5, 4.7, 3.3, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Chicken curry', 'chicken curry murgh', 'non-veg', true, 260, 18, 6, 18, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Egg curry', 'egg curry anda curry', 'non-veg', true, 147, 8, 6, 10, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 katori', 150),
  ('Egg, boiled', 'boiled egg anda', 'non-veg', true, 155, 13, 1.1, 11, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 egg', 50),
  ('Samosa', 'samosa', 'snacks', true, 309, 5.1, 33.1, 17.4, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 piece', 60),
  ('Pakora, vegetable', 'pakora bhaji fritter', 'snacks', true, 314, 6.1, 49.3, 10.2, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '100 g', 100),
  ('Vada, medu', 'vada medu wada', 'snacks', true, 266, 12.75, 33.25, 9.73, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 piece', 50),
  ('Dhokla', 'dhokla khaman', 'snacks', true, 133, 4, 23, 3, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '2 pieces', 100),
  ('Chai (milk tea)', 'chai tea milk', 'beverages', true, 40, 1.5, 5.2, 1.2, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 cup', 150),
  ('Coffee with milk', 'coffee milk', 'beverages', true, 45, 1.4, 6, 1, 'ifct_reference', 'Aggregated public nutrition references', 'reference', '1 cup', 150);

-- A second household-portion option per food, beyond the default_serving_name
-- above — the "1 bowl"/"1 katori" household units the PRD prioritizes, plus
-- a 100g precision option for everything.
insert into food_servings (food_id, label, grams, sort_order)
select id, '100 g', 100, 1 from foods where is_indian_food = true and source = 'ifct_reference';

insert into food_servings (food_id, label, grams, sort_order)
select id, default_serving_name, default_serving_g, 0 from foods where is_indian_food = true and source = 'ifct_reference';
