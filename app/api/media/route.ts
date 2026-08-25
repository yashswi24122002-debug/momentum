import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { reverseGeocode } from "@/lib/integrations/nominatim";

const BUCKET = "media";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("trip_id");
  const contentWorthy = searchParams.get("content_worthy");
  const tag = searchParams.get("tag");

  let query = supabase.from("media").select("*").order("uploaded_at", { ascending: false });
  if (tripId) query = query.eq("trip_id", tripId);
  if (contentWorthy !== null) query = query.eq("content_worthy", contentWorthy === "true");
  if (tag) query = query.contains("tags", [tag]);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The bucket is private (Setup Guide §3) — file_url stores the object
  // path, not a usable URL, so every read generates a fresh signed URL.
  const media = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.file_url, SIGNED_URL_TTL_SECONDS);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ media });
}

// The client uploads the file directly to Supabase Storage (see
// lib/media/exif.ts for the client-side EXIF extraction that happens
// first), then calls this with the resulting storage path plus whatever
// EXIF it found — this route just does the reverse-geocode + DB insert.
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { storage_path, taken_at, location_lat, location_lng, trip_id } = body as {
    storage_path?: string;
    taken_at?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    trip_id?: string | null;
  };

  if (!storage_path || typeof storage_path !== "string") {
    return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
  }

  const locationName =
    typeof location_lat === "number" && typeof location_lng === "number"
      ? await reverseGeocode(location_lat, location_lng)
      : null;

  const { data, error } = await supabase
    .from("media")
    .insert({
      file_url: storage_path,
      taken_at: taken_at ?? null,
      location_lat: location_lat ?? null,
      location_lng: location_lng ?? null,
      location_name: locationName,
      trip_id: trip_id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({ media: { ...data, signed_url: signed?.signedUrl ?? null } }, { status: 201 });
}
