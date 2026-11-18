import type { Page } from "playwright";
import { isLegalOrEligibilityQuestion } from "../legalClassifier.js";
import type { FormField } from "../types.js";

export interface LocateElementResult {
  success: boolean;
  selector?: string;
  reason?: string;
}

type MockLocatorFn = (page: Page, label: string) => Promise<string | null>;

let currentMockLocator: MockLocatorFn | null = null;

/**
 * For unit / integration testing: inject a mock locator that resolves an element
 * without making actual external AI calls.
 */
export function setMockStagehandLocator(fn: MockLocatorFn | null): void {
  currentMockLocator = fn;
}

/**
 * Uses Stagehand ONLY to locate an interactive element on the page for a given field label.
 *
 * Rules:
 * - NEVER used for legal / eligibility fields (must go to needs_user).
 * - NEVER chooses the value (values strictly come from answerEngine / user facts).
 * - Lazy-loads Stagehand; if missing or failing, ends gracefully with success: false.
 * - Reads model configuration from process.env (e.g. STAGEHAND_MODEL); no hardcoded keys.
 */
export async function locateFieldWithStagehand(
  page: Page,
  field: FormField
): Promise<LocateElementResult> {
  // 1. Guardrail: Never use Stagehand for legal / eligibility questions
  if (isLegalOrEligibilityQuestion(field.label, field.name || field.id)) {
    return {
      success: false,
      reason: `Field "${field.label}" is classified as a legal/eligibility question; Stagehand fallback is prohibited.`,
    };
  }

  // 2. Check if a mock locator is provided for testing
  if (currentMockLocator) {
    try {
      const mockSelector = await currentMockLocator(page, field.label);
      if (mockSelector) {
        return { success: true, selector: mockSelector };
      }
      return { success: false, reason: `Mock Stagehand could not locate field "${field.label}".` };
    } catch (err) {
      return {
        success: false,
        reason: `Mock Stagehand failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 3. Lazy load Stagehand
  try {
    const { Stagehand } = await import("@browserbasehq/stagehand");

    const modelName = process.env.STAGEHAND_MODEL || "gemini-2.0-flash";
    const stagehand = new Stagehand({
      env: "LOCAL",
      modelName,
    });

    await stagehand.init();

    // Use Stagehand observe to locate the element selector by plain-English instruction
    const observations = await stagehand.page.observe({
      instruction: `Find the interactive input or form control corresponding to the field "${field.label}".`,
    });

    if (observations && observations.length > 0 && observations[0].selector) {
      return {
        success: true,
        selector: observations[0].selector,
      };
    }

    return {
      success: false,
      reason: `Stagehand observe did not find any matching control for field "${field.label}".`,
    };
  } catch (err) {
    // If Stagehand fails to load or error occurs, end as needs_user gracefully
    return {
      success: false,
      reason: `Stagehand locate error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
