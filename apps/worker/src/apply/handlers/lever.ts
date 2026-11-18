import type { Page } from "playwright";
import { readForm } from "../readForm.js";
import { detectCaptcha } from "../captcha.js";
import { fillIfPresent, isDryRun as checkIsDryRun } from "./common.js";
import { processCustomFields, submitAndConfirm } from "./form-runner.js";
import {
  resolveFieldAnswer,
  type BankAnswer,
  type CandidateProfileContext,
} from "../answerEngine.js";
import type { ApplyResult } from "../types.js";

export type UserAnswerData = BankAnswer;

export interface ApplyLeverOptions {
  page: Page;
  url: string;
  profile: CandidateProfileContext;
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
  aiGenerateFn?: (
    prompt: string,
    system?: string
  ) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>;
}

export async function applyLever(options: ApplyLeverOptions): Promise<ApplyResult> {
  const { page, url, profile, answers, resumePdfPath, captureScreenshot } = options;

  const isDryRun = checkIsDryRun();
  const inboxDomain = process.env.QLAM_INBOX_DOMAIN || "mail.qlam.app";
  const inboxEmail = `${profile.inbox_alias}@${inboxDomain}`;

  // 1. Navigate
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // 2. Initial CAPTCHA check
  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields: {},
      screenshotPaths: [],
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA detected on Lever application page.",
    };
  }

  // 3. Inspect form fields
  const fields = await readForm(page);
  const filledFields: Record<string, string> = {};

  const fullName = (profile.name || "").trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

  // 4. Fill standard Lever fields
  const hasSingleName = await page.$('input[name="name"], #name');
  if (hasSingleName) {
    await fillIfPresent(page, ['input[name="name"]', '#name'], fullName, "Full Name", filledFields);
  } else {
    await fillIfPresent(page, ['input[name="first_name"]', '#first_name'], firstName, "First Name", filledFields);
    await fillIfPresent(page, ['input[name="last_name"]', '#last_name'], lastName, "Last Name", filledFields);
  }

  await fillIfPresent(
    page,
    ['input[name="email"]', 'input[type="email"]', '#email'],
    inboxEmail,
    "Email",
    filledFields
  );

  if (profile.phone) {
    await fillIfPresent(
      page,
      ['input[name="phone"]', 'input[type="tel"]', '#phone'],
      profile.phone,
      "Phone",
      filledFields
    );
  }

  // Current company / Org
  const currentCompany = profile.experience?.[0]?.company || "";
  if (currentCompany) {
    await fillIfPresent(page, ['input[name="org"]', '#org'], currentCompany, "Current Company", filledFields);
  }

  // Social & portfolio links
  const links = profile.links || {};
  if (links.linkedin || links.LinkedIn) {
    await fillIfPresent(
      page,
      ['input[name="urls[LinkedIn]"]', 'input[name*="linkedin" i]', 'input[id*="linkedin" i]'],
      links.linkedin || links.LinkedIn || "",
      "LinkedIn",
      filledFields
    );
  }

  if (links.github || links.GitHub) {
    await fillIfPresent(
      page,
      ['input[name="urls[GitHub]"]', 'input[name*="github" i]', 'input[id*="github" i]'],
      links.github || links.GitHub || "",
      "GitHub",
      filledFields
    );
  }

  if (links.portfolio || links.website) {
    await fillIfPresent(
      page,
      ['input[name="urls[Portfolio]"]', 'input[name="urls[Other]"]', 'input[name*="portfolio" i]'],
      links.portfolio || links.website || "",
      "Portfolio",
      filledFields
    );
  }

  // Resume upload
  const resumeInput = await page.$(
    'input[type="file"][name="resume"], input[type="file"]#resume-upload-input, input[type="file"]'
  );
  if (resumeInput && resumePdfPath) {
    await resumeInput.setInputFiles(resumePdfPath);
    filledFields["Resume"] = "Uploaded tailored PDF";
  }

  // 5. Lever comments field: stays empty unless answerEngine answers it from facts
  const commentsInput = await page.$('textarea[name="comments"], #comments');
  if (commentsInput) {
    const commentsField = fields.find(
      (f) => f.name === "comments" || /additional\s+info|comments/i.test(f.label)
    );
    if (commentsField) {
      const res = await resolveFieldAnswer({
        field: commentsField,
        answers,
        profile,
        job: options.job || { title: "Role", companyName: "Company" },
        embedFn: options.embedFn,
        aiGenerateFn: options.aiGenerateFn,
      });
      if (res.answer && res.confidence >= 0.8 && res.answer.trim().length > 0) {
        await commentsInput.fill(res.answer);
        filledFields["Additional Comments"] = res.answer;
      }
    }
  }

  // 6. Custom & Screening fields
  const skipPatterns = [
    /first.*name/i,
    /last.*name/i,
    /full.*name/i,
    /^name$/i,
    /email/i,
    /phone/i,
    /current\s+company|organization/i,
    /linkedin|github|portfolio/i,
    /additional\s+info|comments/i,
  ];

  const { unansweredRequired, questionsNeedingUser } = await processCustomFields({
    page,
    fields,
    skipPatterns,
    answers,
    profile,
    job: options.job,
    embedFn: options.embedFn,
    aiGenerateFn: options.aiGenerateFn,
    filledFields,
  });

  // 7. Halt if unanswered required questions exist
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

  // 8. Screenshot after filling
  const filledScreenshot = await captureScreenshot("filled");
  const screenshotPaths: string[] = [filledScreenshot];

  // 9. CAPTCHA check after filling
  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA detected after filling Lever form.",
    };
  }

  // 10. Dry Run Gate
  if (isDryRun) {
    return {
      success: true,
      dryRun: true,
      confirmationText:
        "[DRY RUN] Lever form filled successfully - submission skipped per DRY_RUN mode.",
      filledFields,
      screenshotPaths,
    };
  }

  // 11. Live Submit
  const confirmationText = await submitAndConfirm({
    page,
    submitSelector:
      '#btn-submit, button[data-qa="btn-submit"], button[type="submit"], .template-btn-submit, input[type="submit"]',
    confirmationSelector:
      '.application-confirmation, #application_confirmation, [data-qa="confirmation"]',
  });

  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: false,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA triggered upon Lever submission.",
    };
  }

  const submittedScreenshot = await captureScreenshot("submitted");
  screenshotPaths.push(submittedScreenshot);

  return {
    success: true,
    dryRun: false,
    confirmationText,
    filledFields,
    screenshotPaths,
    submittedAt: new Date().toISOString(),
  };
}
