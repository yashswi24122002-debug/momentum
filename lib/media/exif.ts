import { gps, parse } from "exifr";

export type ExtractedExif = {
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Client-side EXIF extraction — runs in the browser before upload, so the
 * server never has to re-download the file to read its metadata. Content
 * Creation PRD §9: a photo with no GPS/date data must not block upload,
 * the location fields just stay null for manual tagging.
 */
export async function extractExif(file: File): Promise<ExtractedExif> {
  const [gpsData, meta] = await Promise.all([
    gps(file).catch(() => null),
    parse(file, { pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null),
  ]);

  const takenDate: unknown = meta?.DateTimeOriginal ?? meta?.CreateDate ?? null;

  return {
    takenAt: takenDate instanceof Date ? takenDate.toISOString() : null,
    lat: gpsData?.latitude ?? null,
    lng: gpsData?.longitude ?? null,
  };
}
