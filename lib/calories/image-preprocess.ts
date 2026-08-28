const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

/**
 * Resizes/recompresses an image client-side before it ever leaves the
 * browser (PRD §11: "resize/compress and strip unnecessary EXIF before
 * transfer"). Redrawing onto a canvas discards EXIF metadata as a side
 * effect, so no separate stripping step is needed. Returns both the
 * compressed Blob (for the eventual Storage upload if the user saves) and
 * its base64 payload (for the analyse-photo API call), so the same
 * preprocessing pass serves both.
 */
export async function preprocessMealPhoto(file: File): Promise<{ blob: Blob; base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't compress image"))), "image/jpeg", JPEG_QUALITY);
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read image"));
    reader.readAsDataURL(blob);
  });

  return { blob, base64, mimeType: "image/jpeg" };
}
