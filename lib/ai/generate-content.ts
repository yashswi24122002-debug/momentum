import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { resolveGeminiApiKey } from "@/lib/admin/resolve-api-key";
import { getFallbackMemberKeys, nextFallbackIndex } from "@/lib/ai/fallback-keys";

// Master PRD §3/§5: one function all Gemini calls go through, so the
// provider is swappable later. The PRD specifies gemini-2.5-flash, but
// Google has since deprecated it for new API keys ("no longer available to
// new users" — 404 from the API) in favor of gemini-3.6-flash, verified
// working directly against this project's key.
const MODEL = "gemini-3.6-flash";

export class GenerateContentError extends Error {}
export class QuotaExceededError extends Error {}

function isQuotaError(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 429;
}

/**
 * Calls Gemini with structured JSON output validated against `schema`.
 * Retries once on a malformed/invalid response, then throws rather than
 * ever returning or persisting unvalidated data (Master PRD §5). A quota
 * error (HTTP 429) short-circuits immediately instead of retrying — the
 * same exhausted key will just fail identically a second time, wasting
 * another request against an already-blown daily cap.
 *
 * `apiKey` is resolved per-caller (09-Admin-Access-Control-PRD.md §9) —
 * the admin's own env key, or a member's own key via
 * lib/admin/resolve-api-key.ts — never a module-level singleton, since
 * which key applies depends on who's calling.
 */
export async function generateContent<T>(apiKey: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  const client = new GoogleGenAI({ apiKey });
  const jsonSchema = z.toJSONSchema(schema);

  async function attempt(): Promise<T> {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini response was not valid JSON");
    }

    return schema.parse(parsed);
  }

  try {
    return await attempt();
  } catch (error) {
    if (isQuotaError(error)) throw new QuotaExceededError("This key's Gemini quota is exhausted");
    try {
      return await attempt();
    } catch (error2) {
      if (isQuotaError(error2)) throw new QuotaExceededError("This key's Gemini quota is exhausted");
      throw new GenerateContentError(
        `Gemini response did not match the expected schema after retry: ${
          error2 instanceof Error ? error2.message : String(error2)
        }`
      );
    }
  }
}

/**
 * Resolves the caller's key and generates, same as generateContent() — but
 * when the ADMIN's own key is the one that's quota-exhausted, falls back to
 * a member key instead of failing the request outright. Round-robins
 * across every member key the admin has already entered (never the
 * member's in-app usage_limits/usage_counters — those track feature usage
 * within the app, not whose Gemini quota happened to serve a given
 * request, so fallback usage is deliberately invisible to that system).
 * Only applies to admin calls: a member's own key running out has no
 * fallback, same as resolveGeminiApiKey's existing behavior.
 */
export async function generateContentAsUser<T>(
  userId: string,
  isAdmin: boolean,
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const primaryKey = await resolveGeminiApiKey(userId, isAdmin);

  try {
    return await generateContent(primaryKey, prompt, schema);
  } catch (error) {
    if (!isAdmin || !(error instanceof QuotaExceededError)) throw error;

    const pool = await getFallbackMemberKeys();
    if (pool.length === 0) throw error;

    for (let i = 0; i < pool.length; i++) {
      const idx = await nextFallbackIndex(pool.length);
      const member = pool[idx];
      try {
        const result = await generateContent(member.apiKey, prompt, schema);
        console.log(`[ai-fallback] admin quota exhausted — served via member ${member.userId}`);
        return result;
      } catch (fallbackError) {
        if (!(fallbackError instanceof QuotaExceededError)) throw fallbackError;
        // This member's key is also exhausted — advance to the next one.
      }
    }

    throw error; // every fallback key was also exhausted
  }
}
