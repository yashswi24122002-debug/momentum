import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

export async function GET() {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("job_applications")
    .select("id, company, role_title, url, status, contact_email, sent_at, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}

export async function POST(request: NextRequest) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { company, role_title, jd_text, url } = body as {
    company?: string;
    role_title?: string;
    jd_text?: string;
    url?: string | null;
  };

  if (!company?.trim() || !role_title?.trim() || !jd_text?.trim()) {
    return NextResponse.json({ error: "company, role_title, and jd_text are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      company: company.trim(),
      role_title: role_title.trim(),
      jd_text: jd_text.trim(),
      url: url?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data }, { status: 201 });
}
