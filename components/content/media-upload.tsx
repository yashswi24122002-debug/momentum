"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { extractExif } from "@/lib/media/exif";
import type { Trip, MediaWithUrl } from "@/lib/types/content";

const BUCKET = "media";

export function MediaUpload({
  trips,
  onUploaded,
}: {
  trips: Trip[];
  onUploaded: (media: MediaWithUrl) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tripId, setTripId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const supabase = createClient();
    let failures = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const exif = await extractExif(file);
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined,
        });
        if (uploadError) throw uploadError;

        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_path: path,
            taken_at: exif.takenAt,
            location_lat: exif.lat,
            location_lng: exif.lng,
            trip_id: tripId === "none" ? null : tripId,
          }),
        });
        if (!res.ok) throw new Error("insert failed");

        const { media } = await res.json();
        onUploaded(media);
      } catch {
        failures++;
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setUploading(false);
    setProgress(null);
    if (failures > 0) toast.error(`${failures} photo(s) failed to upload — try again.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={tripId} onValueChange={(v) => setTripId(v ?? "none")}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Assign to trip" />
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading && progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload photos"}
      </Button>
    </div>
  );
}
