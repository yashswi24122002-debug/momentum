import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/admin/crypto";

export type FallbackKey = { userId: string; apiKey: string };

/**
 * Every member key the admin has already entered (user_api_keys), in a
 * stable order (oldest-added first) so rotation is deterministic across
 * calls. Uses the service-role client — same reasoning as
 * resolveGeminiApiKey: this table's RLS is admin-only, and this runs
 * server-side regardless of whose request triggered it.
 */
export async function getFallbackMemberKeys(): Promise<FallbackKey[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_api_keys")
    .select("user_id, api_key_encrypted")
    .eq("provider", "gemini")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({ userId: row.user_id, apiKey: decryptApiKey(row.api_key_encrypted) }));
}

/** Atomically reads and advances the shared rotation pointer. */
export async function nextFallbackIndex(poolSize: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("next_fallback_key_index", { p_pool_size: poolSize });
  if (error || typeof data !== "number") return 0;
  return data;
}
