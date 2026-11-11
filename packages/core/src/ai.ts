import { GoogleGenAI } from "@google/genai";
import { type z } from "zod";

export interface GenerateJSONParams<T extends z.ZodTypeAny> {
  system?: string;
  prompt: string;
  schema: T;
}

/**
 * Generate structured JSON validated against a Zod schema using Gemini.
 * Performs one retry if initial generation or schema validation fails.
 */
export async function generateJSON<T extends z.ZodTypeAny>({
  system,
  prompt,
  schema,
}: GenerateJSONParams<T>): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const model = process.env.GEMINI_FAST_MODEL;
  if (!model) {
    throw new Error("Missing GEMINI_FAST_MODEL in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  let currentPrompt = prompt;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: currentPrompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Received empty response from Gemini");
      }

      const parsed = JSON.parse(text);
      const validationResult = schema.safeParse(parsed);

      if (validationResult.success) {
        return validationResult.data;
      }

      const issues = validationResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      lastError = new Error(`Schema validation failed: ${issues}`);

      currentPrompt = `${prompt}\n\n[Correction Required]: Previous response failed schema validation: ${issues}. Please return strictly valid JSON matching the schema.`;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      currentPrompt = `${prompt}\n\n[Correction Required]: An error occurred while parsing previous response (${lastError.message}). Please return strictly valid JSON matching the schema.`;
    }
  }

  throw lastError ?? new Error("generateJSON failed after retry");
}

/**
 * Generate 768-dimensional L2-normalized embeddings for a list of texts using Gemini.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const model = process.env.GEMINI_EMBED_MODEL;
  if (!model) {
    throw new Error("Missing GEMINI_EMBED_MODEL in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model,
    contents: texts,
    config: {
      outputDimensionality: 768,
    },
  });

  const rawEmbeddings =
    response.embeddings ??
    ((response as unknown as { embedding?: { values?: number[] } }).embedding
      ? [(response as unknown as { embedding: { values?: number[] } }).embedding]
      : []);

  if (rawEmbeddings.length === 0) {
    throw new Error("No embeddings returned by Gemini embedContent");
  }

  const results: number[][] = [];
  for (const item of rawEmbeddings) {
    const values = item.values;
    if (!values || values.length !== 768) {
      throw new Error(
        `Expected embedding with exactly 768 dimensions, received ${values ? values.length : 0}`
      );
    }

    const norm = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0));
    const normalized = norm === 0 ? values : values.map((val) => val / norm);
    results.push(normalized);
  }

  return results;
}
