import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import type { ResumeContent } from "@/lib/types/resume";

// One row per user, created lazily on first save — there's no POST/DELETE,
// just "the current profile" (GET) and "replace its content" (PATCH),
// mirroring the calorie_settings-style singleton-per-user pattern.
export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase.from("resume_profile").select("*").eq("user_id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as Partial<ResumeContent>;

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("resume_profile")
    .upsert(
      {
        user_id: user.id,
        name: body.name,
        email: body.email ?? null,
        github: body.github ?? null,
        mobile: body.mobile ?? null,
        linkedin: body.linkedin ?? null,
        location: body.location ?? null,
        education: body.education ?? [],
        skills: body.skills ?? [],
        experience: body.experience ?? [],
        projects: body.projects ?? [],
        honors: body.honors ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
