import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/admin/crypto";

export class NoApiKeyError extends Error {
  constructor() {
    super("API key not set by admin. Ask them to add your Gemini API key before using this feature.");
  }
}

/**
 * 09-Admin-Access-Control-PRD.md §9: the admin's own AI calls always use
 * their env-configured key (unchanged from before this system existed); a
 * member's calls use the key the admin entered on their behalf, decrypted
 * only here, server-side, at the moment of use. No fallback to the admin's
 * key if a member has none — that defeats the entire point of per-user
 * keys, so it fails loudly instead.
 *
 * Always uses the service-role client for the lookup, never the caller's
 * own session — user_api_keys' RLS is deliberately admin-only (§6), so a
 * member's own RLS-scoped client would get zero rows back for their own key.
 */
export async function resolveGeminiApiKey(userId: string, isAdmin: boolean): Promise<string> {
  if (isAdmin) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    return key;
  }

  const admin = createAdminClient();
  const { data } = await admin.from("user_api_keys").select("api_key_encrypted").eq("user_id", userId).eq("provider", "gemini").maybeSingle();
  if (!data) throw new NoApiKeyError();
  return decryptApiKey(data.api_key_encrypted);
}
