import type { Json } from "@qlam/core";
import { getServiceClient } from "../utils/supabase.js";

/**
 * Sanitizes event data so no phone numbers, email addresses,
 * or environment variables are stored in the events table or console.
 */
export function sanitizeEventData(data: Record<string, unknown>): Json {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("phone") || keyLower.includes("tel")) {
      sanitized[key] = "[REDACTED_PHONE]";
    } else if (keyLower.includes("email") || keyLower.includes("mail")) {
      sanitized[key] = "[REDACTED_EMAIL]";
    } else if (typeof val === "string") {
      let str = val.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[REDACTED_EMAIL]");
      str = str.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[REDACTED_PHONE]");
      sanitized[key] = str;
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      sanitized[key] = sanitizeEventData(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized as unknown as Json;
}

/**
 * Logs structured events to public.events without exposing PII.
 */
export async function logApplyEvent(
  userId: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getServiceClient();
    const cleanData = sanitizeEventData(data);
    await supabase.from("events").insert({
      user_id: userId,
      type,
      data: cleanData,
    });
  } catch (err) {
    console.error(`[apply-job] Failed to log event "${type}":`, err instanceof Error ? err.message : err);
  }
}
