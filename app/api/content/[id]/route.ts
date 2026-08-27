import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

// Not in the PRD's route table, but /content/[id] (full report detail
// view) needs to fetch a single idea plus its report and matched media.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data, error } = await supabase
    .from("content_ideas")
    .select("*, content_reports(*)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const BUCKET = "media";
  const { data: matchedMedia } = await supabase
    .from("media")
    .select("*")
    .in("id", data.matched_media_ids ?? []);

  const mediaWithUrls = await Promise.all(
    (matchedMedia ?? []).map(async (m) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(m.file_url, 3600);
      return { ...m, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ content_idea: { ...data, matched_media: mediaWithUrls } });
}

// Hard delete — cascades to content_reports via its FK. Doesn't touch the
// matched media itself, only the idea's reference to it.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { error } = await supabase.from("content_ideas").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
