"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, PackageX, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarcodeScanner } from "@/components/calories/barcode-scanner";
import { LogPortionDialog } from "@/components/calories/log-portion-dialog";
import { SOURCE_LABELS, CONFIDENCE_TONES } from "@/lib/calories/ui";
import type { FoodWithServings, FoodLogWithItems } from "@/lib/types/calories";

export function BarcodeLog({ logDate, onLogged }: { logDate?: string; onLogged: (log: FoodLogWithItems) => void }) {
  const [loading, setLoading] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [food, setFood] = useState<FoodWithServings | null>(null);

  async function handleCode(code: string) {
    setLoading(true);
    setNotFoundCode(null);
    setFood(null);
    try {
      const res = await fetch(`/api/calories/barcode/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error("Couldn't look that up — try again.");
        return;
      }
      if (!json.found) {
        setNotFoundCode(code);
        return;
      }
      setFood(json.food);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 className="size-5 animate-spin" />
        Looking up that barcode…
      </div>
    );
  }

  if (notFoundCode) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <PackageX className="size-6 text-text-muted" />
        <p className="text-sm text-text-secondary">No usable nutrition data found for code {notFoundCode}.</p>
        <p className="text-xs text-text-muted">This can happen for less common Indian products — add it as a personal food from the label instead.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNotFoundCode(null)}>
            Try another code
          </Button>
          <Button size="sm" render={<Link href="/calories/foods" />} nativeButton={false}>
            <Plus className="size-3.5" />
            Add from label
          </Button>
        </div>
      </div>
    );
  }

  if (food) {
    return (
      <div className="space-y-4">
        <Card className="gap-2 border-border bg-surface p-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{food.name}</h3>
            {food.brand && <p className="text-xs text-text-muted">{food.brand}</p>}
          </div>
          <p className="text-sm text-text-secondary">
            {Math.round(food.kcal_per_100g)} kcal/100g · P{food.protein_g_per_100g} C{food.carbs_g_per_100g} F{food.fat_g_per_100g}
          </p>
          <StatusBadge label={SOURCE_LABELS[food.source]} tone={CONFIDENCE_TONES[food.confidence]} />
        </Card>
        <Button variant="outline" size="sm" onClick={() => setFood(null)}>
          Scan a different item
        </Button>
        <LogPortionDialog
          open={true}
          onOpenChange={(open) => !open && setFood(null)}
          food={food}
          logDate={logDate}
          onLogged={(log) => {
            setFood(null);
            onLogged(log);
          }}
        />
      </div>
    );
  }

  return <BarcodeScanner onCode={handleCode} />;
}
