/**
 * OpenStreetMap Nominatim reverse geocoding — free, no key, but rate-limited
 * and usage-policy-gated to ~1 req/sec with a descriptive User-Agent. Fine
 * for this app's usage pattern (one lookup per photo upload, by a single
 * user), never called in a loop.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": "momentum-app/1.0 (personal content-planning tool)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const address = json.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.county;
    const country = address.country;
    return [city, country].filter(Boolean).join(", ") || json.display_name || null;
  } catch {
    return null;
  }
}
