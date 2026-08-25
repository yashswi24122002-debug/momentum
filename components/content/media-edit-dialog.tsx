"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Trip, MediaWithUrl } from "@/lib/types/content";

// Keyed by media.id in the parent so each photo gets a fresh mount (and
// thus fresh initial state) instead of an effect syncing state to props.
function MediaEditForm({
  media,
  trips,
  onOpenChange,
  onSaved,
}: {
  media: MediaWithUrl;
  trips: Trip[];
  onOpenChange: (open: boolean) => void;
  onSaved: (media: MediaWithUrl) => void;
}) {
  const [tags, setTags] = useState((media.tags ?? []).join(", "));
  const [rating, setRating] = useState(media.rating ? String(media.rating) : "");
  const [contentWorthy, setContentWorthy] = useState(media.content_worthy);
  const [tripId, setTripId] = useState(media.trip_id ?? "none");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/media/${media.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        rating: rating ? Number(rating) : null,
        content_worthy: contentWorthy,
        trip_id: tripId === "none" ? null : tripId,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save that — try again.");
      return;
    }
    const { media: updated } = await res.json();
    onSaved({ ...updated, signed_url: media.signed_url });
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tag photo</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Trip</Label>
          <Select value={tripId} onValueChange={(v) => setTripId(v ?? "none")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No trip</SelectItem>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tags (comma-separated)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="beach, sunset, food" />
        </div>
        <div className="space-y-1.5">
          <Label>Rating (1-5)</Label>
          <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <Checkbox checked={contentWorthy} onCheckedChange={(v) => setContentWorthy(v === true)} />
          Content-worthy
        </label>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={save} disabled={saving}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function MediaEditDialog({
  media,
  trips,
  onOpenChange,
  onSaved,
}: {
  media: MediaWithUrl | null;
  trips: Trip[];
  onOpenChange: (open: boolean) => void;
  onSaved: (media: MediaWithUrl) => void;
}) {
  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {media && (
          <MediaEditForm key={media.id} media={media} trips={trips} onOpenChange={onOpenChange} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}
