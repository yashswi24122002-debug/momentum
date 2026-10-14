import { GoogleGenAI } from "@google/genai";
import type { ContentListUnion } from "@google/genai";
import { z } from "zod";
import { resolveGeminiApiKey } from "@/lib/admin/resolve-api-key";
import { getFallbackMemberKeys, nextFallbackIndex, checkFallbackRateLimit } from "@/lib/ai/fallback-keys";

// Master PRD §3/§5: one function all Gemini calls go through, so the
// provider is swappable later. The PRD specifies gemini-2.5-flash, but
// Google has since deprecated it for new API keys ("no longer available to
// new users" — 404 from the API) in favor of gemini-3.6-flash, verified
// working directly against this project's key.
const MODEL = "gemini-3.6-flash";

export class GenerateContentError extends Error {}
export class QuotaExceededError extends Error {}
export class ServerOverloadedError extends Error {}

function isQuotaError(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 429;
}

// Google's own "high demand" 503 — distinct from a quota error (429) and
// from a genuinely malformed response. In practice this has turned out to
// be the single most common draft-pitch failure (confirmed via error_logs:
// every logged "couldn't produce a usable pitch" was actually this, not a
// real schema mismatch), so it gets its own detection, its own short
// backoff-and-retry loop, and its own honest error message instead of
// being lumped into "the response didn't match the schema."
function isOverloadedError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  return status === 503 || /unavailable|overloaded|high demand/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_OVERLOAD_RETRIES = 3;

async function runGenerate<T>(apiKey: string, contents: ContentListUnion, schema: z.ZodType<T>): Promise<T> {
  const client = new GoogleGenAI({ apiKey });
  const jsonSchema = z.toJSONSchema(schema);

  async function attempt(): Promise<T> {
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
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

  let lastOverloadError: unknown;
  let usedMalformedRetry = false;

  for (let i = 0; i < MAX_OVERLOAD_RETRIES; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (isQuotaError(error)) throw new QuotaExceededError("This key's Gemini quota is exhausted");

      if (isOverloadedError(error)) {
        lastOverloadError = error;
        if (i < MAX_OVERLOAD_RETRIES - 1) await sleep(600 * (i + 1));
        continue;
      }

      // A genuine malformed/invalid response (not overload, not quota) —
      // one extra immediate attempt (no backoff needed, it's not a
      // rate/availability issue), then give up with the schema-mismatch
      // message. Only ever used once per call, regardless of how many
      // overload retries happened first.
      if (usedMalformedRetry) {
        throw new GenerateContentError(
          `Gemini response did not match the expected schema: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      usedMalformedRetry = true;
    }
  }

  throw new ServerOverloadedError(
    `Gemini is temporarily overloaded: ${lastOverloadError instanceof Error ? lastOverloadError.message : String(lastOverloadError)}`
  );
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
 *
 * Text-only by design (08-Calorie-Tracker-PRD.md §12: "create an
 * image-aware helper rather than forcing images through the text helper")
 * — see generateContentWithImage() below for the multimodal equivalent.
 */
export async function generateContent<T>(apiKey: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  return runGenerate(apiKey, prompt, schema);
}

/** Same as generateContent(), but sends an image alongside the prompt. */
export async function generateContentWithImage<T>(
  apiKey: string,
  prompt: string,
  schema: z.ZodType<T>,
  image: { mimeType: string; base64: string }
): Promise<T> {
  return runGenerate(apiKey, [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }], schema);
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
async function generateAsUser<T>(
  userId: string,
  isAdmin: boolean,
  schema: z.ZodType<T>,
  run: (apiKey: string) => Promise<T>
): Promise<T> {
  const primaryKey = await resolveGeminiApiKey(userId, isAdmin);

  try {
    return await run(primaryKey);
  } catch (error) {
    if (!isAdmin || !(error instanceof QuotaExceededError)) throw error;

    const pool = await getFallbackMemberKeys();
    if (pool.length === 0) throw error;

    // Bounds how many times this path can fire in a short burst (stuck
    // retry loop, rapid clicking) — over the cap, surface the original
    // quota error instead of cascading through every member's key.
    if (!(await checkFallbackRateLimit())) throw error;

    for (let i = 0; i < pool.length; i++) {
      const idx = await nextFallbackIndex(pool.length);
      const member = pool[idx];
      try {
        const result = await run(member.apiKey);
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

export async function generateContentAsUser<T>(
  userId: string,
  isAdmin: boolean,
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  return generateAsUser(userId, isAdmin, schema, (apiKey) => generateContent(apiKey, prompt, schema));
}

/** Same as generateContentAsUser(), but sends an image alongside the prompt. */
export async function generateContentWithImageAsUser<T>(
  userId: string,
  isAdmin: boolean,
  prompt: string,
  schema: z.ZodType<T>,
  image: { mimeType: string; base64: string }
): Promise<T> {
  return generateAsUser(userId, isAdmin, schema, (apiKey) => generateContentWithImage(apiKey, prompt, schema, image));
}
