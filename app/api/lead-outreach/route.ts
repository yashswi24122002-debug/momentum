import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  // Capped rather than fully paginated for now — see the same note in
  // app/api/leads/route.ts.
  const { data, error } = await supabase
    .from("lead_outreach")
    .select("*, business_leads(name, category, area)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ outreach: data });
}
