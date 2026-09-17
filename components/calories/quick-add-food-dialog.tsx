"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { FoodWithServings } from "@/lib/types/calories";

type FetchedDetails = {
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

function emptyForm(name: string) {
  return {
    name,
    brand: "",
    kcal_per_100g: "",
    protein_g_per_100g: "",
    carbs_g_per_100g: "",
    fat_g_per_100g: "",
    default_serving_name: "",
    default_serving_g: "",
  };
}

/**
 * Creates a personal food and hands it straight back so the caller can open
 * LogPortionDialog for it immediately — the previous path ("no matches" →
 * go manage foods elsewhere → come back and search again to actually log
 * it) took you away from the Add Food flow entirely. This stays in it.
 */
export function QuickAddFoodDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (food: FoodWithServings) => void;
}) {
  const [form, setForm] = useState(() => emptyForm(initialName));
  const [saving, setSaving] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

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
    const { food } = await res.json();
    toast.success("Food saved.");
    onCreated({ ...food, food_servings: [] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
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
            {saving ? "Saving…" : "Save & log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
