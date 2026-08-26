import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

// Not in the PRD's route table (only POST is listed), but the document
// vault UI page needs a way to list what's already uploaded.
export async function GET(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const universityId = searchParams.get("university_id");

  let query = supabase.from("documents").select("*").order("uploaded_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  if (universityId) query = query.eq("university_id", universityId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_url, SIGNED_URL_TTL_SECONDS);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents });
}

// The client uploads the file directly to Supabase Storage, then calls
// this with the resulting storage path (same pattern as /api/media).
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { name, storage_path, task_id, university_id } = body as {
    name?: string;
    storage_path?: string;
    task_id?: string | null;
    university_id?: string | null;
  };

  if (!name || typeof name !== "string" || !storage_path || typeof storage_path !== "string") {
    return NextResponse.json({ error: "name and storage_path are required" }, { status: 400 });
  }

  // version = 1 + however many documents already exist for this task, so
  // re-uploading a doc for the same task tracks as a new version.
  let version = 1;
  if (task_id) {
    const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("task_id", task_id);
    version = (count ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      name,
      file_url: storage_path,
      task_id: task_id ?? null,
      university_id: university_id ?? null,
      version,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({ document: { ...data, signed_url: signed?.signedUrl ?? null } }, { status: 201 });
}
