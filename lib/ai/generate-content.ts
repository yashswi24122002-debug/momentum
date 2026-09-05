import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Master PRD §3/§5: one function all Gemini calls go through, so the
// provider is swappable later. The PRD specifies gemini-2.5-flash, but
// Google has since deprecated it for new API keys ("no longer available to
// new users" — 404 from the API) in favor of gemini-3.6-flash, verified
// working directly against this project's key.
const MODEL = "gemini-3.6-flash";

export class GenerateContentError extends Error {}

/**
 * Calls Gemini with structured JSON output validated against `schema`.
 * Retries once on a malformed/invalid response, then throws rather than
 * ever returning or persisting unvalidated data (Master PRD §5).
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
        // Every caller here wants a structured JSON extraction/synthesis
        // from context already gathered (not open-ended reasoning), so the
        // model's default "thinking" pass just adds latency without
        // improving output — measured 6-27s per call before this change.
        thinkingConfig: { thinkingBudget: 0 },
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
  } catch {
    try {
      return await attempt();
    } catch (error) {
      throw new GenerateContentError(
        `Gemini response did not match the expected schema after retry: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
