import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Resumes reuse the existing private "documents" bucket rather than a
// dedicated one — same signed-URL pattern as /api/documents.
const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

// Not in the PRD's route table, but draft-outreach's resume picker and any
// resume-management UI need a way to list what's on file.
export async function GET() {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase.from("resumes").select("*").order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumes = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_url, SIGNED_URL_TTL_SECONDS);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ resumes });
}

// The client uploads the file directly to Supabase Storage, then calls this
// with the resulting storage path — same pattern as /api/documents.
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { name, storage_path, focus_area } = body as {
    name?: string;
    storage_path?: string;
    focus_area?: string | null;
  };

  if (!name || typeof name !== "string" || !storage_path || typeof storage_path !== "string") {
    return NextResponse.json({ error: "name and storage_path are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("resumes")
    .insert({ name, file_url: storage_path, focus_area: focus_area ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({ resume: { ...data, signed_url: signed?.signedUrl ?? null } }, { status: 201 });
}
