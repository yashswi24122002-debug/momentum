import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { searchLocalBusinesses } from "@/lib/integrations/google-places";
import { logError } from "@/lib/errors/log-error";
import type { LeadArea } from "@/lib/types/leads";

const VALID_AREAS: LeadArea[] = ["noida", "ghaziabad", "greater_noida", "other"];

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { area, area_label, category } = body as { area?: string; area_label?: string; category?: string | null };

  if (!area || !VALID_AREAS.includes(area as LeadArea)) {
    return NextResponse.json({ error: "area is required (noida, ghaziabad, greater_noida, or other)" }, { status: 400 });
  }
  if (area === "other" && !area_label?.trim()) {
    return NextResponse.json({ error: "area_label is required when area is 'other'" }, { status: 400 });
  }

  const { results, error: placesError } = await searchLocalBusinesses(area as LeadArea, area_label ?? null, category ?? null);
  if (placesError) {
    await logError(supabase, "leads/discover", placesError, { area, category });
  }
  if (results.length === 0) {
    return NextResponse.json({ error: placesError ?? "No businesses found for that search" }, { status: placesError ? 502 : 200 });
  }

  // De-dupe against this user's own existing leads by Google's stable
  // place ID (the PRD's chosen key) — a plain insert with onConflict lets
  // Postgres do this in one round trip instead of pre-fetching everything.
  const { data: inserted, error: insertError } = await supabase
    .from("business_leads")
    .upsert(
      results.map((r) => ({
        user_id: user.id,
        name: r.name,
        category: r.category,
        address: r.address,
        area,
        phone: r.phone,
        existing_website: r.website,
        google_rating: r.rating,
        google_place_id: r.place_id,
      })),
      { onConflict: "user_id,google_place_id", ignoreDuplicates: true }
    )
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ fetched: results.length, inserted: inserted?.length ?? 0 });
}
