import type { SupabaseClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 3600;

/** Signs a documents-bucket path if set, for attaching to an outreach email. */
export async function signAttachment(
  supabase: SupabaseClient,
  path: string | null,
  filename: string
): Promise<{ filename: string; path: string } | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ? { filename, path: data.signedUrl } : null;
}
