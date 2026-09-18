import type { LeadArea } from "@/lib/types/leads";

export type PlaceResult = {
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
};

const AREA_LABELS: Record<Exclude<LeadArea, "other">, string> = {
  noida: "Noida, Uttar Pradesh, India",
  ghaziabad: "Ghaziabad, Uttar Pradesh, India",
  greater_noida: "Greater Noida, Uttar Pradesh, India",
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.primaryTypeDisplayName",
].join(",");

/**
 * Places API (New) Text Search — one call gets everything the PRD wanted
 * from Text Search + a separate Place Details call, since the New API can
 * return phone/website/rating directly via a field mask (the legacy API
 * this PRD was modeled on needed the second call; this one doesn't).
 * Never throws — a bad/missing key or a network failure just yields no
 * results, same defensive shape as the other integrations/*.ts wrappers.
 */
export async function searchLocalBusinesses(
  area: LeadArea,
  areaLabel: string | null,
  category: string | null
): Promise<{ results: PlaceResult[]; error?: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { results: [], error: "GOOGLE_PLACES_API_KEY is not configured" };
  }

  const location = area === "other" ? areaLabel?.trim() : AREA_LABELS[area];
  if (!location) {
    return { results: [], error: "A location is required" };
  }

  const textQuery = `${category?.trim() || "businesses"} in ${location}`;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, pageSize: 20 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { results: [], error: `Places API ${response.status}: ${body.slice(0, 300)}` };
    }

    const data = (await response.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        websiteUri?: string;
        rating?: number;
        primaryTypeDisplayName?: { text?: string };
      }[];
    };

    const results: PlaceResult[] = (data.places ?? []).map((p) => ({
      place_id: p.id,
      name: p.displayName?.text ?? "Unknown business",
      address: p.formattedAddress ?? null,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      rating: p.rating ?? null,
      category: p.primaryTypeDisplayName?.text ?? null,
    }));

    return { results };
  } catch (error) {
    return { results: [], error: error instanceof Error ? error.message : String(error) };
  }
}
