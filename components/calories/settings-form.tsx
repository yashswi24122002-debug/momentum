"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/swr-fetcher";
import { todayLocalISODate } from "@/lib/date";
import type { CalorieSettings } from "@/lib/types/calories";

export function SettingsForm({ onSaved }: { onSaved?: (settings: CalorieSettings) => void }) {
  const { data: settingsData, mutate: mutateSettings } = useSWR<{ settings: CalorieSettings | null }>(
    "/api/calories/settings",
    fetcher
  );
  const settings = settingsData?.settings ?? null;
  const [goal, setGoal] = useState("2000");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync the form fields from fetched/mutated settings during render (not in
  // an effect) — React's recommended pattern for adjusting state when a value
  // from an external source changes, avoiding an extra render pass.
  const [syncedSettingsData, setSyncedSettingsData] = useState(settingsData);
  if (settingsData !== syncedSettingsData) {
    setSyncedSettingsData(settingsData);
    if (settingsData?.settings) {
      setGoal(String(settingsData.settings.daily_calorie_goal));
      setProtein(settingsData.settings.protein_goal_g ? String(settingsData.settings.protein_goal_g) : "");
      setCarbs(settingsData.settings.carbs_goal_g ? String(settingsData.settings.carbs_goal_g) : "");
      setFat(settingsData.settings.fat_goal_g ? String(settingsData.settings.fat_goal_g) : "");
    }
  }

  async function handleSave() {
    const dailyGoal = Number(goal);
    if (!Number.isFinite(dailyGoal) || dailyGoal < 500 || dailyGoal > 10000) {
      toast.error("Daily calorie goal must be between 500 and 10000.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/calories/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_calorie_goal: dailyGoal,
        protein_goal_g: protein ? Number(protein) : null,
        carbs_goal_g: carbs ? Number(carbs) : null,
        fat_goal_g: fat ? Number(fat) : null,
        effective_from: todayLocalISODate(),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      return;
    }
    const { settings: updated } = await res.json();
    mutateSettings({ settings: updated }, { revalidate: false });
    toast.success("Saved.");
    onSaved?.(updated);
  }

  if (settingsData === undefined) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <Card className="max-w-md gap-4 border-border bg-surface p-5">
      <div className="space-y-1.5">
        <Label htmlFor="daily-goal">Daily calorie goal *</Label>
        <Input id="daily-goal" type="number" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="protein-goal">Protein goal (g, optional)</Label>
        <Input id="protein-goal" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="carbs-goal">Carbs goal (g, optional)</Label>
        <Input id="carbs-goal" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fat-goal">Fat goal (g, optional)</Label>
        <Input id="fat-goal" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : settings ? "Save changes" : "Set goal and start tracking"}
      </Button>
    </Card>
  );
}
