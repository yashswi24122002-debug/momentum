-- Removes the recipe feature per user request. food_log_items.recipe_id
-- and food_favourites.recipe_id keep their historical values (already-
-- logged entries store their own nutrition snapshot independent of the
-- recipe row, so nothing about past data breaks) — cascade just drops the
-- now-dangling FK constraints pointing at the table being removed.
drop table if exists recipe_ingredients;
drop table if exists recipes cascade;
