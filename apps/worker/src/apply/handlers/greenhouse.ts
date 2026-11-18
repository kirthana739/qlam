import type { Page } from "playwright";
import type { QuestionToAsk } from "@qlam/core";
import { readForm } from "../readForm.js";
import { detectCaptcha } from "../captcha.js";
import { fillIfPresent, selectIfPresent, isDryRun as checkIsDryRun } from "./common.js";
import { resolveFieldAnswer, type BankAnswer } from "../answerEngine.js";
import type { ApplyResult } from "../types.js";

export interface GreenhouseProfileData {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  links?: Record<string, string> | null;
  work_authorization?: string | null;
  needs_sponsorship?: boolean;
  notice_period_days?: number | null;
  expected_salary?: string | null;
  preferences?: Record<string, unknown> | null;
  skills?: string[];
  experience?: Array<{
    position?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    fieldOfStudy?: string;
    graduationDate?: string;
  }>;
  summary?: string;
  inbox_alias: string;
}

export type UserAnswerData = BankAnswer;

export interface ApplyGreenhouseOptions {
  page: Page;
  url: string;
  profile: GreenhouseProfileData;
  answers: UserAnswerData[];
  job?: {
    title: string;
    companyName: string;
    location?: string | null;
    descriptionText?: string | null;
  };
  resumePdfPath: string;
  captureScreenshot: (name: "filled" | "submitted") => Promise<string>;
  embedFn?: (text: string) => Promise<number[]>;
  aiGenerateFn?: (prompt: string, system?: string) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>;
}

export { detectCaptcha };

export async function applyGreenhouse(
  options: ApplyGreenhouseOptions
): Promise<ApplyResult> {
  const { page, url, profile, answers, resumePdfPath, captureScreenshot } = options;

  const isDryRun = checkIsDryRun();

  const inboxDomain = process.env.QLAM_INBOX_DOMAIN || "mail.qlam.app";
  const inboxEmail = `${profile.inbox_alias}@${inboxDomain}`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields: {},
      screenshotPaths: [],
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA detected on application page.",
    };
  }

  // 3. Inspect all form fields
  const fields = await readForm(page);
  const filledFields: Record<string, string> = {};
  const unansweredRequired: string[] = [];

  const fullName = (profile.name || "").trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

  // 4. Fill standard known Greenhouse fields
  await fillIfPresent(page, ['#first_name', 'input[name="job_application[first_name]"]', 'input[autocomplete="given-name"]'], firstName, "First Name", filledFields);
  await fillIfPresent(page, ['#last_name', 'input[name="job_application[last_name]"]', 'input[autocomplete="family-name"]'], lastName, "Last Name", filledFields);
  await fillIfPresent(page, ['#email', 'input[name="job_application[email]"]', 'input[type="email"]'], inboxEmail, "Email", filledFields);
  if (profile.phone) {
    await fillIfPresent(page, ['#phone', 'input[name="job_application[phone]"]', 'input[type="tel"]'], profile.phone, "Phone", filledFields);
  }
  const location = profile.city || "";
  if (location) {
    await fillIfPresent(page, ['#job_application_location', 'input[name="job_application[location]"]', '#location'], location, "Location", filledFields);
  }
  const links = profile.links || {};
  const linkedInUrl = links.linkedin || links.LinkedIn || links.Linkedin || "";
  if (linkedInUrl) {
    await fillIfPresent(page, ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[name*="urls[LinkedIn]"]'], linkedInUrl, "LinkedIn", filledFields);
  }
  const websiteUrl = links.portfolio || links.website || links.github || "";
  if (websiteUrl) {
    await fillIfPresent(page, ['input[name*="website" i]', 'input[id*="website" i]', 'input[name*="urls[Website]"]'], websiteUrl, "Website", filledFields);
  }

  const fileInput = await page.$(
    'input[type="file"]#resume, input[type="file"][name*="resume"], input[type="file"]'
  );
  if (fileInput && resumePdfPath) {
    await fileInput.setInputFiles(resumePdfPath);
    filledFields["Resume"] = "Uploaded tailored PDF";
  }

  // 5. Custom / Additional fields resolved through answerEngine
  const questionsNeedingUser: QuestionToAsk[] = [];

  for (const field of fields) {
    if (
      /first.*name/i.test(field.label) ||
      /last.*name/i.test(field.label) ||
      /email/i.test(field.label) ||
      /phone/i.test(field.label) ||
      /location/i.test(field.label) ||
      /linkedin/i.test(field.label) ||
      field.type === "file"
    ) {
      continue;
    }

    const resolution = await resolveFieldAnswer({
      field,
      answers,
      profile,
      job: options.job || {
        title: "Role",
        companyName: "Company",
      },
      embedFn: options.embedFn,
      aiGenerateFn: options.aiGenerateFn,
    });

    if (resolution.answer && resolution.confidence >= 0.8) {
      if (field.type === "select") {
        await selectIfPresent(page, field.selector, resolution.answer, field.label, filledFields);
      } else if (field.type === "radio" || field.type === "checkbox") {
        const optionSelector = `${field.selector}[value="${resolution.answer}"], input[name="${field.name || ""}"]`;
        const el = await page.$(optionSelector);
        if (el) {
          await el.click().catch(() => {});
          filledFields[field.label] = resolution.answer;
        } else {
          await fillIfPresent(page, [field.selector], resolution.answer, field.label, filledFields);
        }
      } else {
        await fillIfPresent(page, [field.selector], resolution.answer, field.label, filledFields);
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

  // If unanswered required questions exist, set needs_user
  if (unansweredRequired.length > 0) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields,
      screenshotPaths: [],
      needsUser: true,
      needsUserReason: `Missing required questions: ${JSON.stringify(questionsNeedingUser)}`,
      unansweredQuestions: unansweredRequired,
    };
  }

  // 6. Screenshot after filling (proof)
  const filledScreenshotPath = await captureScreenshot("filled");
  const screenshotPaths: string[] = [filledScreenshotPath];

  // 7. Check for CAPTCHA after filling
  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA detected after filling form.",
    };
  }

  // 8. Dry Run Gate: Live submit requires BOTH DRY_RUN=false AND ALLOW_LIVE_SUBMIT=true
  if (isDryRun) {
    return {
      success: true,
      dryRun: true,
      confirmationText: "[DRY RUN] Form filled successfully - submission skipped per DRY_RUN mode.",
      filledFields,
      screenshotPaths,
    };
  }

  // 9. Live Submission
  const submitButton = await page.$(
    'input[type="submit"]#submit_app, button[type="submit"], input[type="submit"], button#submit_app'
  );

  if (!submitButton) {
    throw new Error("Could not find submit button on Greenhouse form.");
  }

  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    submitButton.click(),
  ]);

  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: false,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA triggered upon submission.",
    };
  }

  const confirmationSelector =
    '#application_confirmation, .application-confirmation, [data-qa="confirmation"]';

  let confirmationText = "Application submitted successfully.";
  try {
    const confirmationEl = await page.waitForSelector(confirmationSelector, {
      state: "visible",
      timeout: 15_000,
    });
    if (confirmationEl) {
      const text = await confirmationEl.textContent();
      if (text) {
        confirmationText = text.trim();
      }
    }
  } catch {
    const heading = await page.$eval("h1, h2", (h) => h.textContent).catch(() => null);
    if (heading && /thank|received|submitted|success/i.test(heading)) {
      confirmationText = heading.trim();
    }
  }

  const submittedScreenshotPath = await captureScreenshot("submitted");
  screenshotPaths.push(submittedScreenshotPath);

  return {
    success: true,
    dryRun: false,
    confirmationText,
    filledFields,
    screenshotPaths,
    submittedAt: new Date().toISOString(),
  };
}
