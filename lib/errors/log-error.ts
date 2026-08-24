import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Master PRD §6: every external integration must fail gracefully and log to
 * error_logs rather than crash the whole request — there's no ops team to
 * alert otherwise. Never throws itself; a logging failure shouldn't take
 * down the request that triggered it.
 */
export async function logError(
  supabase: SupabaseClient,
  source: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("error_logs").insert({ source, message, context: context ?? null });
  } catch {
    // Best-effort only.
  }
  console.error(`[${source}]`, message, context ?? "");
}
