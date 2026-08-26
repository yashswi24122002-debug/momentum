import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase.from("universities").select("*").order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ universities: data });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { name, program_name, city, intake_target, deadline_uni_assist, deadline_direct, fit_notes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("universities")
    .insert({
      name,
      program_name: program_name ?? null,
      city: city ?? null,
      intake_target: intake_target ?? null,
      deadline_uni_assist: deadline_uni_assist ?? null,
      deadline_direct: deadline_direct ?? null,
      fit_notes: fit_notes ?? null,
      source: "manual",
      verified: true, // manually-entered universities are inherently the user's own verified info
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ university: data }, { status: 201 });
}
