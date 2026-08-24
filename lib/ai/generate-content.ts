import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Master PRD §3/§5: one function all Gemini calls go through, so the
// provider is swappable later. The PRD specifies gemini-2.5-flash, but
// Google has since deprecated it for new API keys ("no longer available to
// new users" — 404 from the API) in favor of gemini-3.6-flash, verified
// working directly against this project's key.
const MODEL = "gemini-3.6-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export class GenerateContentError extends Error {}

/**
 * Calls Gemini with structured JSON output validated against `schema`.
 * Retries once on a malformed/invalid response, then throws rather than
 * ever returning or persisting unvalidated data (Master PRD §5).
 */
export async function generateContent<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema);

  async function attempt(): Promise<T> {
    const response = await getClient().models.generateContent({
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
