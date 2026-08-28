import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Separate from lib/ai/generate-content.ts by design (08-Calorie-Tracker-
// PRD.md §12: "create an image-aware helper rather than forcing images
// through the text helper") — this one sends multimodal contents
// (text + inlineData image part), the text helper never needs to.
const MODEL = "gemini-3.6-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export class AnalysePhotoError extends Error {}

// Matches 08-Calorie-Tracker-PRD.md §11's required response shape exactly.
export const PhotoAnalysisItemSchema = z.object({
  name: z.string(),
  likelyIndianDish: z.boolean(),
  portionLabel: z.string(),
  estimatedGrams: z.number(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
});

export const PhotoAnalysisSchema = z.object({
  overallConfidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional(),
  items: z.array(PhotoAnalysisItemSchema),
  warnings: z.array(z.string()),
});

export type PhotoAnalysisResult = z.infer<typeof PhotoAnalysisSchema>;

const PROMPT = `You are analyzing a photo of a meal for a personal calorie-tracking app used in India. Identify each distinct food component visible (e.g. "2 rotis", "dal", "mixed vegetable sabzi") — never give one combined total for the whole plate.

For each component, provide:
- name: a short, specific name
- likelyIndianDish: whether it's a common Indian dish/preparation
- portionLabel: a household portion description (e.g. "2 pieces", "1 katori", "150g")
- estimatedGrams: your best estimate of its actual weight in the photo
- kcal, proteinG, carbsG, fatG: your best estimate for that ACTUAL portion shown (not per-100g figures)
- confidence: a realistic 0-1 score for this specific item — do not be optimistic
- assumptions: what you had to assume (e.g. "assumed 1 tsp oil", "assumed medium katori size", "assumed standard sugar/ghee level")

You cannot see hidden oil, ghee, or the exact recipe/preparation used in the photo — that uncertainty must be reflected honestly in confidence and called out in assumptions, not smoothed over.

If the image shows no recognizable food at all, return an empty items array, set overallConfidence to 0, and explain why in warnings. Never invent a food that isn't actually visible.

If something in the image is ambiguous in a way one specific clarifying question would resolve (e.g. you can't tell if a bowl is dal or sambar), set needsClarification to true and provide that question in clarificationQuestion — but still return your best-guess items either way, don't block on it.

Set overallConfidence as a realistic average across your item confidences, not the best case.`;

/**
 * Sends one meal photo to Gemini and returns a structured, per-component
 * draft — never persists anything itself (PRD §11: "nothing persists until
 * ... the user presses Save").
 */
export async function analysePhoto(imageBase64: string, mimeType: string): Promise<PhotoAnalysisResult> {
  const jsonSchema = z.toJSONSchema(PhotoAnalysisSchema);

  async function attempt(): Promise<PhotoAnalysisResult> {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents: [PROMPT, { inlineData: { data: imageBase64, mimeType } }],
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

    return PhotoAnalysisSchema.parse(parsed);
  }

  try {
    return await attempt();
  } catch {
    try {
      return await attempt();
    } catch (error) {
      throw new AnalysePhotoError(
        `Gemini response did not match the expected schema after retry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
