import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { isValidFrequencyDays } from "@/lib/habits/schedule";

export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ habits: data });
}

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { name, category, frequency_days, color } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (frequency_days !== undefined && !isValidFrequencyDays(frequency_days)) {
    return NextResponse.json(
      { error: "frequency_days must be a non-empty array of integers 0-6" },
      { status: 400 }
    );
  }

  const { data: maxSortRow } = await supabase
    .from("habits")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxSortRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("habits")
    .insert({
      name,
      category: category ?? null,
      sort_order: nextSortOrder,
      ...(frequency_days !== undefined && { frequency_days }),
      ...(color !== undefined && { color }),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ habit: data }, { status: 201 });
}
