import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Sorted "no website" first, then by rating — the PRD's pitch: a
// good-reviews business with no site is the strongest sales angle.
export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const status = searchParams.get("status");
  const hasWebsite = searchParams.get("has_website");

  let query = supabase.from("business_leads").select("*").eq("user_id", user.id);
  if (area) query = query.eq("area", area);
  if (status) query = query.eq("status", status);
  if (hasWebsite === "true") query = query.not("existing_website", "is", null);
  if (hasWebsite === "false") query = query.is("existing_website", null);

  const { data, error } = await query
    .order("existing_website", { ascending: true, nullsFirst: true })
    .order("google_rating", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data });
}
