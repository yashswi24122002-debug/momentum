"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { TripManager } from "@/components/content/trip-manager";
import { MediaUpload } from "@/components/content/media-upload";
import { MediaEditDialog } from "@/components/content/media-edit-dialog";
import type { Trip, MediaWithUrl } from "@/lib/types/content";

export function MediaLibrary() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [media, setMedia] = useState<MediaWithUrl[] | null>(null);
  const [tripFilter, setTripFilter] = useState("all");
  const [worthyOnly, setWorthyOnly] = useState(false);
  const [editing, setEditing] = useState<MediaWithUrl | null>(null);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((json) => setTrips(json.trips ?? []));
  }, []);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (tripFilter !== "all") params.set("trip_id", tripFilter);
      if (worthyOnly) params.set("content_worthy", "true");
      const res = await fetch(`/api/media?${params}`);
      const json = await res.json();
      setMedia(json.media ?? []);
    }
    load();
  }, [tripFilter, worthyOnly]);

  if (trips === null || media === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/content" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Media library</h1>
      </div>

      <TripManager trips={trips} onCreated={(trip) => setTrips((prev) => [trip, ...(prev ?? [])])} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MediaUpload trips={trips} onUploaded={(m) => setMedia((prev) => [m, ...(prev ?? [])])} />
        <div className="flex items-center gap-2">
          <Select value={tripFilter} onValueChange={(v) => setTripFilter(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trips</SelectItem>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={worthyOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setWorthyOnly((v) => !v)}
          >
            <Star className="size-3.5" />
            Content-worthy
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No photos yet"
          description="Upload photos to start tagging trips, locations, and content-worthy shots."
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {media.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEditing(m)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-surface-hover"
            >
              {m.signed_url && (
                <Image src={m.signed_url} alt={m.location_name ?? "Photo"} fill className="object-cover" unoptimized />
              )}
              {m.content_worthy && (
                <span className="absolute top-1 right-1 rounded-full bg-background/80 p-1">
                  <Star className="size-3 fill-warning text-warning" />
                </span>
              )}
              {m.location_name && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-1.5 py-0.5 text-[10px] text-text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                  {m.location_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <MediaEditDialog
        media={editing}
        trips={trips}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(updated) => setMedia((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? null)}
      />
    </div>
  );
}
