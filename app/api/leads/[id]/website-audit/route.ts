import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";

const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

// Latest audit for this lead (re-analyzing inserts a new row rather than
// overwriting — see the migration's comment — so "latest" is the one that
// matters for the dialog/report).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data, error } = await supabase
    .from("website_audits")
    .select("*")
    .eq("lead_id", id)
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let screenshotUrl: string | null = null;
  if (data?.screenshot_path) {
    const { data: signed } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(data.screenshot_path, SIGNED_URL_TTL_SECONDS);
    screenshotUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({ audit: data, screenshotUrl });
}

// Sets report_pdf_path once the client generates the PDF and uploads it —
// PDF rendering is client-side (jsPDF), same as the Jobs tool's resume/
// cover-letter PDFs, so this just records where it landed.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { audit_id, report_pdf_path } = body as { audit_id?: string; report_pdf_path?: string };

  if (!audit_id || typeof report_pdf_path !== "string") {
    return NextResponse.json({ error: "audit_id and report_pdf_path are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("website_audits")
    .update({ report_pdf_path })
    .eq("id", audit_id)
    .eq("lead_id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ audit: data });
}
