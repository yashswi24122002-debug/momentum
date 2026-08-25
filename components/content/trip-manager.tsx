"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Trip } from "@/lib/types/content";

export function TripManager({ trips, onCreated }: { trips: Trip[]; onCreated: (trip: Trip) => void }) {
  const [name, setName] = useState("");
  const [locationSummary, setLocationSummary] = useState("");
  const [creating, setCreating] = useState(false);

  async function addTrip(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), location_summary: locationSummary.trim() || null }),
    });
    setCreating(false);
    if (!res.ok) {
      toast.error("Couldn't add that trip — try again.");
      return;
    }
    const { trip } = await res.json();
    onCreated(trip);
    setName("");
    setLocationSummary("");
  }

  return (
    <Card className="gap-3 border-border bg-surface p-4">
      <form onSubmit={addTrip} className="flex flex-col gap-2 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trip name (e.g. Japan 2026)" />
        <Input
          value={locationSummary}
          onChange={(e) => setLocationSummary(e.target.value)}
          placeholder="Location summary (optional)"
        />
        <Button type="submit" disabled={creating || !name.trim()}>
          <Plus className="size-4" />
          Add trip
        </Button>
      </form>
      {trips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trips.map((t) => (
            <span key={t.id} className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
              {t.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
