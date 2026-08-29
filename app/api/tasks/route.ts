import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { DEFAULT_TASK_TEMPLATE } from "@/lib/masters-abroad/task-template";

const VALID_CATEGORIES = ["documents", "exams", "financial", "visa", "application", "language"];

export async function GET(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const universityId = searchParams.get("university_id");

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true, nullsFirst: false });
  if (category) query = query.eq("category", category);
  if (universityId) query = query.eq("university_id", universityId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

async function seedDefaultTemplate(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  // Idempotent — don't double-seed if this user's universal tasks already exist.
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("university_id", null);
  if (count && count > 0) {
    return { error: "Default tasks already seeded" as const };
  }

  const idByKey = new Map<string, string>();
  // Insert in the template's own order — every item's dependencies are
  // defined earlier in the list, so by the time we reach a dependent task
  // all the IDs it needs are already resolved.
  for (const item of DEFAULT_TASK_TEMPLATE) {
    const dependsOn = item.dependsOnKeys.map((k) => idByKey.get(k)).filter((v): v is string => Boolean(v));
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: item.title,
        category: item.category,
        depends_on: dependsOn,
        instructions: item.instructions ?? null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    idByKey.set(item.key, data.id);
  }

  return { error: null };
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  if (body.action === "seed_default") {
    const result = await seedDefaultTemplate(supabase, user.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).is("university_id", null);
    return NextResponse.json({ tasks: data }, { status: 201 });
  }

  const { title, category, deadline, university_id, instructions, where_to_apply_url, depends_on } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      category: category ?? null,
      deadline: deadline ?? null,
      university_id: university_id ?? null,
      instructions: instructions ?? null,
      where_to_apply_url: where_to_apply_url ?? null,
      depends_on: Array.isArray(depends_on) ? depends_on : [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
