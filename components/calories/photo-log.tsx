"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { preprocessMealPhoto } from "@/lib/calories/image-preprocess";
import { createClient } from "@/lib/supabase/client";
import { MEAL_TYPE_ORDER, MEAL_TYPE_LABELS } from "@/lib/calories/ui";
import type { PhotoAnalysisResult } from "@/lib/ai/analyse-food";
import type { MealType, FoodLogWithItems } from "@/lib/types/calories";

const BUCKET = "media";

type DraftItem = {
  name: string;
  portionLabel: string;
  estimatedGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: number;
  assumptions: string[];
};

export function PhotoLog({ logDate, onLogged }: { logDate?: string; onLogged: (log: FoodLogWithItems) => void }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setAnalyzing(true);
    setAnalysis(null);
    setItems([]);
    try {
      const { blob, base64, mimeType } = await preprocessMealPhoto(file);
      const res = await fetch("/api/calories/analyse-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't analyse that photo — try again." }));
        toast.error(error);
        return;
      }
      const { analysis: result } = await res.json();
      setAnalysis(result);
      setItems(
        result.items.map((i: PhotoAnalysisResult["items"][number]) => ({
          name: i.name,
          portionLabel: i.portionLabel,
          estimatedGrams: i.estimatedGrams,
          kcal: i.kcal,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          confidence: i.confidence,
          assumptions: i.assumptions,
        }))
      );
      setPendingBlob(blob);
    } catch {
      toast.error("Couldn't process that photo — try a different one.");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: field === "name" || field === "portionLabel" ? value : Number(value) || 0 } : item))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankItem() {
    setItems((prev) => [...prev, { name: "", portionLabel: "", estimatedGrams: 100, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, confidence: 1, assumptions: [] }]);
  }

  function reset() {
    setAnalysis(null);
    setItems([]);
    setPendingBlob(null);
  }

  async function handleSave() {
    if (items.length === 0) {
      toast.error("Add at least one item before saving.");
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      toast.error("Every item needs a name.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (pendingBlob) {
        const supabase = createClient();
        const path = `meal-photos/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pendingBlob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        photoUrl = path;
      }

      const res = await fetch("/api/calories/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_on: logDate,
          meal_type: mealType,
          source: "ai_photo",
          photo_url: photoUrl,
          items: items.map((i) => ({
            display_name: i.name,
            quantity: 1,
            serving_label: i.portionLabel || `${i.estimatedGrams}g`,
            serving_g: i.estimatedGrams,
            kcal: i.kcal,
            protein_g: i.proteinG,
            carbs_g: i.carbsG,
            fat_g: i.fatG,
            source: "ai_photo",
            confidence: "estimated",
            ai_confidence: i.confidence,
          })),
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Couldn't save that meal — try again." }));
        toast.error(error);
        return;
      }
      const { log } = await res.json();
      toast.success("Logged.");
      reset();
      onLogged(log);
    } catch {
      toast.error("Couldn't save that meal — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 className="size-5 animate-spin" />
        Analysing your photo…
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
          <Camera className="size-4" />
          Take or upload a meal photo
        </Button>
        <p className="text-xs text-text-muted">
          Photo estimates cannot see oil/ghee or the exact recipe. You&apos;ll review and edit every component before saving.
        </p>
      </div>
    );
  }

  const lowConfidence = analysis.overallConfidence < 0.6;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-background p-3 text-xs text-text-secondary">
        Photo estimates cannot see oil/ghee or the exact recipe. Review before saving.
      </div>

      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Low confidence ({Math.round(analysis.overallConfidence * 100)}%) — consider logging this via Search or saving it as a Recipe
            next time for more accurate results.
          </span>
        </div>
      )}

      {analysis.needsClarification && analysis.clarificationQuestion && (
        <div className="rounded-lg bg-info/10 p-3 text-xs text-info">{analysis.clarificationQuestion}</div>
      )}

      {analysis.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {analysis.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <Card key={index} className="gap-2 border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <Input value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} placeholder="Item name" className="flex-1" />
              <Button variant="ghost" size="icon-sm" onClick={() => removeItem(index)} aria-label="Remove item">
                <Trash2 className="size-4 text-text-muted" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Portion</Label>
                <Input value={item.portionLabel} onChange={(e) => updateItem(index, "portionLabel", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grams</Label>
                <Input type="number" value={item.estimatedGrams} onChange={(e) => updateItem(index, "estimatedGrams", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Kcal</Label>
                <Input type="number" value={item.kcal} onChange={(e) => updateItem(index, "kcal", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein</Label>
                <Input type="number" value={item.proteinG} onChange={(e) => updateItem(index, "proteinG", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs</Label>
                <Input type="number" value={item.carbsG} onChange={(e) => updateItem(index, "carbsG", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat</Label>
                <Input type="number" value={item.fatG} onChange={(e) => updateItem(index, "fatG", e.target.value)} />
              </div>
            </div>
            {item.assumptions.length > 0 && (
              <p className="text-xs text-text-muted">Assumed: {item.assumptions.join("; ")}</p>
            )}
            <span className="text-xs text-text-muted">Confidence: {Math.round(item.confidence * 100)}%</span>
          </Card>
        ))}

        <Button variant="outline" size="sm" onClick={addBlankItem} className="w-full">
          <Plus className="size-3.5" />
          Add another item
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Meal</Label>
        <Select value={mealType} onValueChange={(v) => v && setMealType(v as MealType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_TYPE_ORDER.map((m) => (
              <SelectItem key={m} value={m}>
                {MEAL_TYPE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={reset} className="flex-1">
          Try a different photo
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save meal"}
        </Button>
      </div>
    </div>
  );
}
