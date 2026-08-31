-- Fixes "new row violates row-level security policy for table foods" on
-- every barcode scan of a not-yet-cached product. Phase 2's "insert own"
-- policy on foods required auth.uid() = user_id unconditionally, but the
-- barcode-cache path (app/api/calories/barcode/[code]/route.ts) inserts a
-- shared catalogue row with user_id left null on purpose (Group C design:
-- "a default would silently attach every future barcode-cache insert to
-- whichever user happened to scan it first") — auth.uid() = null is never
-- true, so that insert was rejected outright, not just for personal-food
-- creation. Same bug on food_servings' insert check, which the barcode
-- route also writes to right after creating the foods row.
drop policy if exists "insert own" on foods;
create policy "insert own or global" on foods for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "via foods ownership" on food_servings;
create policy "via foods ownership" on food_servings for all to authenticated
  using (exists (select 1 from foods f where f.id = food_servings.food_id and (f.user_id is null or f.user_id = auth.uid() or is_admin(auth.uid()))))
  with check (exists (select 1 from foods f where f.id = food_servings.food_id and (f.user_id is null or f.user_id = auth.uid())));
