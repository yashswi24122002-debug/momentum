"use client";

import { useEffect, useState } from "react";
import { Plus, Star, Trash2, Soup } from "lucide-react";
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
import type { FoodWithServings } from "@/lib/types/calories";

const EMPTY_FORM = {
  name: "",
  brand: "",
  category: "",
  kcal_per_100g: "",
  protein_g_per_100g: "",
  carbs_g_per_100g: "",
  fat_g_per_100g: "",
  default_serving_name: "",
  default_serving_g: "",
};

export function FoodsPage() {
  const [personalFoods, setPersonalFoods] = useState<FoodWithServings[] | null>(null);
  const [catalogue, setCatalogue] = useState<FoodWithServings[] | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FoodWithServings | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    const [personalRes, catalogueRes, favRes] = await Promise.all([
      fetch("/api/calories/foods?personalOnly=true"),
      fetch("/api/calories/foods?indianOnly=true"),
      fetch("/api/calories/favourites"),
    ]);
    const personalJson = await personalRes.json();
    const catalogueJson = await catalogueRes.json();
    const favJson = await favRes.json();
    setPersonalFoods(personalJson.foods ?? []);
    setCatalogue(catalogueJson.foods ?? []);
    setFavouriteIds(new Set((favJson.favourites ?? []).filter((f: { food_id: string | null }) => f.food_id).map((f: { food_id: string }) => f.food_id)));
  }

  useEffect(() => {
    async function load() {
      const [personalRes, catalogueRes, favRes] = await Promise.all([
        fetch("/api/calories/foods?personalOnly=true"),
        fetch("/api/calories/foods?indianOnly=true"),
        fetch("/api/calories/favourites"),
      ]);
      const personalJson = await personalRes.json();
      const catalogueJson = await catalogueRes.json();
      const favJson = await favRes.json();
      setPersonalFoods(personalJson.foods ?? []);
      setCatalogue(catalogueJson.foods ?? []);
      setFavouriteIds(new Set((favJson.favourites ?? []).filter((f: { food_id: string | null }) => f.food_id).map((f: { food_id: string }) => f.food_id)));
    }
    load();
  }, []);

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
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(food.id);
      else next.add(food.id);
      return next;
    });
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.kcal_per_100g) {
      toast.error("Name and calories per 100g are required.");
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
    setPersonalFoods((prev) => prev?.filter((f) => f.id !== deleteTarget.id) ?? null);
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
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                <Label>Kcal / 100g *</Label>
                <Input type="number" value={form.kcal_per_100g} onChange={(e) => setForm({ ...form, kcal_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Protein g / 100g</Label>
                <Input type="number" value={form.protein_g_per_100g} onChange={(e) => setForm({ ...form, protein_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Carbs g / 100g</Label>
                <Input type="number" value={form.carbs_g_per_100g} onChange={(e) => setForm({ ...form, carbs_g_per_100g: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fat g / 100g</Label>
                <Input type="number" value={form.fat_g_per_100g} onChange={(e) => setForm({ ...form, fat_g_per_100g: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default serving name</Label>
                <Input placeholder="e.g. 1 piece" value={form.default_serving_name} onChange={(e) => setForm({ ...form, default_serving_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Default serving grams</Label>
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
