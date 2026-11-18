import type { Page } from "playwright";
import type { QuestionToAsk } from "@qlam/core";
import type { FormField } from "../types.js";
import {
  fillIfPresent,
  selectIfPresent,
  isDemographicField,
  findDeclineOption,
} from "./common.js";
import { locateFieldWithStagehand } from "./stagehand-fallback.js";
import {
  resolveFieldAnswer,
  type BankAnswer,
  type CandidateProfileContext,
} from "../answerEngine.js";

export interface CustomFieldsOptions {
  page: Page;
  fields: FormField[];
  skipPatterns: RegExp[];
  answers: BankAnswer[];
  profile: CandidateProfileContext;
  job?: {
    title: string;
    companyName: string;
    location?: string | null;
    descriptionText?: string | null;
  };
  embedFn?: (text: string) => Promise<number[]>;
  aiGenerateFn?: (
    prompt: string,
    system?: string
  ) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>;
  filledFields: Record<string, string>;
}

export interface CustomFieldsResult {
  unansweredRequired: string[];
  questionsNeedingUser: QuestionToAsk[];
}

/**
 * Fills custom and screening fields using answerEngine and Stagehand element location fallback.
 */
export async function processCustomFields(
  opts: CustomFieldsOptions
): Promise<CustomFieldsResult> {
  const {
    page,
    fields,
    skipPatterns,
    answers,
    profile,
    job = { title: "Role", companyName: "Company" },
    embedFn,
    aiGenerateFn,
    filledFields,
  } = opts;

  const unansweredRequired: string[] = [];
  const questionsNeedingUser: QuestionToAsk[] = [];

  for (const field of fields) {
    if (field.type === "file") continue;

    // Check if field was already handled by standard selectors
    const labelAndName = `${field.label} ${field.name || ""}`;
    const shouldSkip = skipPatterns.some((pattern) => pattern.test(labelAndName));
    if (shouldSkip) continue;

    // Demographic questions default to "Decline to self-identify"
    if (
      isDemographicField(field.label, field.name) &&
      field.options &&
      field.options.length > 0
    ) {
      const declineOpt = findDeclineOption(field.options);
      if (declineOpt) {
        if (field.type === "select") {
          await selectIfPresent(page, field.selector, declineOpt, field.label, filledFields);
        } else {
          const optEl = await page.$(
            `${field.selector}[value="${declineOpt}"], input[value="${declineOpt}"]`
          );
          if (optEl) {
            await optEl.click().catch(() => {});
            filledFields[field.label] = declineOpt;
          }
        }
        continue;
      }
    }

    // Resolve via answerEngine
    const resolution = await resolveFieldAnswer({
      field,
      answers,
      profile,
      job,
      embedFn,
      aiGenerateFn,
    });

    if (resolution.answer && resolution.confidence >= 0.8) {
      let filled = false;

      if (field.type === "select") {
        filled = await selectIfPresent(
          page,
          field.selector,
          resolution.answer,
          field.label,
          filledFields
        );
      } else if (field.type === "radio" || field.type === "checkbox") {
        const optionSelector = `${field.selector}[value="${resolution.answer}"], input[name="${field.name || ""}"][value="${resolution.answer}"]`;
        const el = await page.$(optionSelector);
        if (el) {
          await el.click().catch(() => {});
          filledFields[field.label] = resolution.answer;
          filled = true;
        } else {
          filled = await fillIfPresent(
            page,
            [field.selector],
            resolution.answer,
            field.label,
            filledFields
          );
        }
      } else {
        filled = await fillIfPresent(
          page,
          [field.selector],
          resolution.answer,
          field.label,
          filledFields
        );
      }

      // Fallback: If not found or interaction failed, use Stagehand ONLY to locate element
      if (!filled && field.required) {
        const located = await locateFieldWithStagehand(page, field);
        if (located.success && located.selector) {
          const fallbackEl = await page.$(located.selector);
          if (fallbackEl) {
            await fallbackEl.fill(resolution.answer);
            filledFields[field.label] = resolution.answer;
            filled = true;
          }
        }
      }

      if (!filled && field.required) {
        questionsNeedingUser.push({
          key: field.name || field.label.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          text: field.label,
          type: field.type,
          options: field.options,
          required: true,
          selector: field.selector,
        });
        unansweredRequired.push(field.label);
      }
    } else if (field.required) {
      questionsNeedingUser.push({
        key: field.name || field.label.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        text: field.label,
        type: field.type,
        options: field.options,
        required: true,
        selector: field.selector,
      });
      unansweredRequired.push(field.label);
    }
  }

  return { unansweredRequired, questionsNeedingUser };
}

/**
 * Clicks submit and waits for confirmation message/screen.
 */
export async function submitAndConfirm(options: {
  page: Page;
  submitSelector: string;
  confirmationSelector: string;
}): Promise<string> {
  const { page, submitSelector, confirmationSelector } = options;

  const submitButton = await page.$(submitSelector);
  if (!submitButton) {
    throw new Error(`Could not find submit button matching "${submitSelector}".`);
  }

  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    submitButton.click(),
  ]);

  let confirmationText = "Application submitted successfully.";
  try {
    const confirmationEl = await page.waitForSelector(confirmationSelector, {
      state: "visible",
      timeout: 15_000,
    });
    if (confirmationEl) {
      const text = await confirmationEl.textContent();
      if (text) confirmationText = text.trim();
    }
  } catch {
    const heading = await page.$eval("h1, h2, h3", (h) => h.textContent).catch(() => null);
    if (heading && /thank|received|submitted|success/i.test(heading)) {
      confirmationText = heading.trim();
    }
  }

  return confirmationText;
}
