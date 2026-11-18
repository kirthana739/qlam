import { GoogleGenAI, ApiError } from "@google/genai";
import { type z } from "zod";

export interface GenerateJSONParams<T extends z.ZodTypeAny> {
  system?: string;
  prompt: string;
  schema: T;
}

export const RETRY_DELAYS_MS = [2000, 5000, 10000]; // 3 attempts, waiting 2s, 5s, 10s
export const AI_BUSY_MESSAGE = "AI is busy, try again";

/**
 * Checks whether an error from Gemini is a 429 (Rate Limit) or 503 (Service Unavailable).
 * Only these two errors are retryable. All other errors return false immediately.
 */
export function isRetryableGeminiError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 503) {
      return true;
    }
  }

  const err = error as Record<string, unknown>;

  // Check numeric status codes (status, statusCode, response.status)
  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.statusCode === "number"
        ? err.statusCode
        : typeof (err.response as Record<string, unknown> | undefined)?.status === "number"
          ? ((err.response as Record<string, unknown>).status as number)
          : null;

  if (status === 429 || status === 503) {
    return true;
  }

  // Check string status or error codes
  const code =
    typeof err.code === "string" || typeof err.code === "number"
      ? String(err.code)
      : typeof err.status === "string"
        ? err.status
        : null;

  if (code) {
    if (
      code === "429" ||
      code === "503" ||
      code === "RESOURCE_EXHAUSTED" ||
      code === "UNAVAILABLE"
    ) {
      return true;
    }
    // Reject other common HTTP client/server status codes immediately
    if (["400", "401", "403", "404", "500"].includes(code)) {
      return false;
    }
  }

  // Fallback to checking error message for 429 / 503 or standard error strings
  if (typeof err.message === "string") {
    const msg = err.message.toLowerCase();
    if (
      /\b(429|503)\b/.test(msg) ||
      msg.includes("resource_exhausted") ||
      msg.includes("unavailable") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("rate limit") ||
      msg.includes("service unavailable") ||
      msg.includes("too many requests")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Retries an asynchronous Gemini operation on 429 and 503 errors only with exponential backoff
 * (3 attempts, waiting 2s, 5s, 10s).
 * If all retries fail, throws a friendly message instead of the raw JSON error.
 * Re-throws other non-retryable errors immediately.
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  delays: number[] = RETRY_DELAYS_MS
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      if (isRetryableGeminiError(err)) {
        if (attempt < delays.length) {
          const delay = delays[attempt] ?? 2000;
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // All retries failed
        throw new Error(AI_BUSY_MESSAGE);
      }
      throw err;
    }
  }
}

/**
 * Generate structured JSON validated against a Zod schema using Gemini.
 * Performs retry with exponential backoff on 429/503 errors, and performs
 * one schema-correction retry if JSON parsing or Zod validation fails.
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
    // API call with 429/503 retry and backoff
    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model,
        contents: currentPrompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
        },
      })
    );

    const text = response.text;
    if (!text) {
      lastError = new Error("Received empty response from Gemini");
      currentPrompt = `${prompt}\n\n[Correction Required]: Previous response was empty. Please return strictly valid JSON matching the schema.`;
      continue;
    }

    try {
      // Strip markdown code fences if model enclosed JSON in ```json ... ```
      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      const parsed = JSON.parse(cleaned);
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
 * Performs retry with exponential backoff on 429 and 503 errors only.
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

  const response = await withGeminiRetry(() =>
    ai.models.embedContent({
      model,
      contents: texts,
      config: {
        outputDimensionality: 768,
      },
    })
  );

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
