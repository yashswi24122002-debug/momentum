"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Star, Trash2, Soup, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { SOURCE_LABELS, CONFIDENCE_TONES } from "@/lib/calories/ui";
import { fetcher } from "@/lib/swr-fetcher";
import type { FoodWithServings } from "@/lib/types/calories";

const EMPTY_FORM = {
  name: "",
  brand: "",
  category: "",
  kcal_per_100g: "",
  protein_g_per_100g: "",
  carbs_g_per_100g: "",
  fat_g_per_100g: "",
  fibre_g_per_100g: "",
  sugar_g_per_100g: "",
  sodium_mg_per_100g: "",
  default_serving_name: "",
  default_serving_g: "",
};

type FetchedDetails = {
  is_beverage: boolean;
  kcal_per_100: number;
  protein_g_per_100: number;
  carbs_g_per_100: number;
  fat_g_per_100: number;
  fibre_g_per_100: number | null;
  sugar_g_per_100: number | null;
  sodium_mg_per_100: number | null;
  default_serving_name: string;
  default_serving_amount: number;
  note: string;
};

type FavouriteRow = { food_id: string | null };

export function FoodsPage() {
  const { data: personalData, mutate: mutatePersonal } = useSWR<{ foods: FoodWithServings[] }>(
    "/api/calories/foods?personalOnly=true",
    fetcher
  );
  const { data: catalogueData, mutate: mutateCatalogue } = useSWR<{ foods: FoodWithServings[] }>(
    "/api/calories/foods?indianOnly=true",
    fetcher
  );
  const { data: favData, mutate: mutateFav } = useSWR<{ favourites: FavouriteRow[] }>("/api/calories/favourites", fetcher);
  const personalFoods = personalData?.foods ?? null;
  const catalogue = catalogueData?.foods ?? null;
  const favouriteIds = new Set(
    (favData?.favourites ?? []).filter((f) => f.food_id).map((f) => f.food_id as string)
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FoodWithServings | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  async function loadAll() {
    await Promise.all([mutatePersonal(), mutateCatalogue(), mutateFav()]);
  }

  async function toggleFavourite(food: FoodWithServings) {
    const isFav = favouriteIds.has(food.id);
    const res = await fetch(isFav ? `/api/calories/favourites?food_id=${food.id}` : "/api/calories/favourites", {
      method: isFav ? "DELETE" : "POST",
      headers: isFav ? undefined : { "Content-Type": "application/json" },
      body: isFav ? undefined : JSON.stringify({ food_id: food.id }),
    });
    if (!res.ok) {
      toast.error("Couldn't update favourites — try again.");
      return;
    }
    mutateFav(
      (prev) =>
        prev && {
          favourites: isFav ? prev.favourites.filter((f) => f.food_id !== food.id) : [...prev.favourites, { food_id: food.id }],
        },
      { revalidate: false }
    );
  }

  async function handleFetchDetails() {
    if (!form.name.trim()) {
      toast.error("Enter a name first.");
      return;
    }
    setFetchingDetails(true);
    const res = await fetch("/api/calories/foods/fetch-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, brand: form.brand || null }),
    });
    setFetchingDetails(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Couldn't fetch details — try again or enter them manually." }));
      toast.error(error);
      return;
    }
    const { details } = (await res.json()) as { details: FetchedDetails };
    setForm((prev) => ({
      ...prev,
      kcal_per_100g: String(details.kcal_per_100),
      protein_g_per_100g: String(details.protein_g_per_100),
      carbs_g_per_100g: String(details.carbs_g_per_100),
      fat_g_per_100g: String(details.fat_g_per_100),
      fibre_g_per_100g: details.fibre_g_per_100 !== null ? String(details.fibre_g_per_100) : "",
      sugar_g_per_100g: details.sugar_g_per_100 !== null ? String(details.sugar_g_per_100) : "",
      sodium_mg_per_100g: details.sodium_mg_per_100 !== null ? String(details.sodium_mg_per_100) : "",
      default_serving_name: details.default_serving_name,
      default_serving_g: String(details.default_serving_amount),
    }));
    toast.success(details.note);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.kcal_per_100g) {
      toast.error("Name and calories per 100g/ml are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/calories/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        kcal_per_100g: Number(form.kcal_per_100g),
        protein_g_per_100g: Number(form.protein_g_per_100g) || 0,
        carbs_g_per_100g: Number(form.carbs_g_per_100g) || 0,
        fat_g_per_100g: Number(form.fat_g_per_100g) || 0,
        fibre_g_per_100g: form.fibre_g_per_100g ? Number(form.fibre_g_per_100g) : null,
        sugar_g_per_100g: form.sugar_g_per_100g ? Number(form.sugar_g_per_100g) : null,
        sodium_mg_per_100g: form.sodium_mg_per_100g ? Number(form.sodium_mg_per_100g) : null,
        default_serving_name: form.default_serving_name.trim() || null,
        default_serving_g: form.default_serving_g ? Number(form.default_serving_g) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save that food — try again.");
      return;
    }
    setForm(EMPTY_FORM);
    setCreateOpen(false);
    toast.success("Food saved.");
    loadAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/calories/foods/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Couldn't delete that — try again.");
      return;
    }
    mutatePersonal((prev) => prev && { foods: prev.foods.filter((f) => f.id !== deleteTarget.id) }, { revalidate: false });
    setDeleteTarget(null);
    toast.success("Deleted.");
  }

  function FoodCard({ food }: { food: FoodWithServings }) {
    return (
      <Card className="gap-1.5 border-border bg-surface p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-text-primary">{food.name}</p>
            {food.brand && <p className="text-xs text-text-muted">{food.brand}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => toggleFavourite(food)} aria-label="Toggle favourite">
              <Star className={`size-4 ${favouriteIds.has(food.id) ? "fill-warning text-warning" : "text-text-muted"}`} />
            </Button>
            {food.is_personal && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-text-muted hover:bg-danger/10 hover:text-danger"
                onClick={() => setDeleteTarget(food)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          {Math.round(food.kcal_per_100g)} kcal/100g · P{food.protein_g_per_100g} C{food.carbs_g_per_100g} F{food.fat_g_per_100g}
        </p>
        <StatusBadge label={SOURCE_LABELS[food.source]} tone={CONFIDENCE_TONES[food.confidence]} />
      </Card>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Foods</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          Personal food
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-text-secondary">Personal foods</h2>
        {personalFoods === null ? null : personalFoods.length === 0 ? (
          <EmptyState icon={Soup} title="No personal foods yet" description="Add foods not in the Indian catalogue — packaged snacks, restaurant dishes, or your own recipes' ingredients." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {personalFoods.map((food) => (
              <FoodCard key={food.id} food={food} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-text-secondary">Indian catalogue</h2>
        {catalogue === null ? null : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogue.map((food) => (
              <FoodCard key={food.id} food={food} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New personal food</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <div className="flex gap-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={handleFetchDetails} disabled={fetchingDetails}>
                  {fetchingDetails ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Fetch details
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                AI-estimated from Indian nutrition standards (IFCT) where it applies — always verify against packaging if you have it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kcal / 100g or 100ml *</Label>
                <Input type="number" value={form.kcal_per_100g} onChange={(e) => setForm({ ...form, kcal_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Protein g / 100g or 100ml</Label>
                <Input type="number" value={form.protein_g_per_100g} onChange={(e) => setForm({ ...form, protein_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Carbs g / 100g or 100ml</Label>
                <Input type="number" value={form.carbs_g_per_100g} onChange={(e) => setForm({ ...form, carbs_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fat g / 100g or 100ml</Label>
                <Input type="number" value={form.fat_g_per_100g} onChange={(e) => setForm({ ...form, fat_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fibre g / 100g or 100ml</Label>
                <Input type="number" value={form.fibre_g_per_100g} onChange={(e) => setForm({ ...form, fibre_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Sugar g / 100g or 100ml</Label>
                <Input type="number" value={form.sugar_g_per_100g} onChange={(e) => setForm({ ...form, sugar_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Sodium mg / 100g or 100ml</Label>
                <Input type="number" value={form.sodium_mg_per_100g} onChange={(e) => setForm({ ...form, sodium_mg_per_100g: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default serving name</Label>
                <Input placeholder="e.g. 1 piece or 1 glass" value={form.default_serving_name} onChange={(e) => setForm({ ...form, default_serving_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default serving grams/ml</Label>
                <Input type="number" value={form.default_serving_g} onChange={(e) => setForm({ ...form, default_serving_g: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving…" : "Save food"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This can't be undone. Past diary entries using this food keep their logged nutrition regardless."
      />
    </div>
  );
}
