import type { Page } from "playwright";
import { readForm } from "../readForm.js";
import { detectCaptcha } from "../captcha.js";
import { fillIfPresent, isDryRun as checkIsDryRun } from "./common.js";
import { processCustomFields, submitAndConfirm } from "./form-runner.js";
import type { BankAnswer, CandidateProfileContext } from "../answerEngine.js";
import type { ApplyResult } from "../types.js";

export type UserAnswerData = BankAnswer;

export interface ApplyAshbyOptions {
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

export async function applyAshby(options: ApplyAshbyOptions): Promise<ApplyResult> {
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
      needsUserReason: "Bot check or CAPTCHA detected on Ashby application page.",
    };
  }

  // 3. Inspect form fields
  const fields = await readForm(page);
  const filledFields: Record<string, string> = {};

  const fullName = (profile.name || "").trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

  // 4. Fill standard Ashby fields (including _systemfield_* selectors)
  const hasSingleName = await page.$(
    'input[name="_systemfield_name"], input[id="_systemfield_name"], input[name="name"], #name'
  );

  if (hasSingleName) {
    await fillIfPresent(
      page,
      ['input[name="_systemfield_name"]', 'input[id="_systemfield_name"]', 'input[name="name"]', '#name'],
      fullName,
      "Full Name",
      filledFields
    );
  } else {
    await fillIfPresent(
      page,
      ['input[name="_systemfield_first_name"]', 'input[name="firstName"]', '#firstName'],
      firstName,
      "First Name",
      filledFields
    );
    await fillIfPresent(
      page,
      ['input[name="_systemfield_last_name"]', 'input[name="lastName"]', '#lastName'],
      lastName,
      "Last Name",
      filledFields
    );
  }

  await fillIfPresent(
    page,
    [
      'input[name="_systemfield_email"]',
      'input[id="_systemfield_email"]',
      'input[name="email"]',
      'input[type="email"]',
      '#email',
    ],
    inboxEmail,
    "Email",
    filledFields
  );

  if (profile.phone) {
    await fillIfPresent(
      page,
      [
        'input[name="_systemfield_phone"]',
        'input[id="_systemfield_phone"]',
        'input[name="phone"]',
        'input[type="tel"]',
        '#phone',
      ],
      profile.phone,
      "Phone",
      filledFields
    );
  }

  const location = profile.city || "";
  if (location) {
    await fillIfPresent(
      page,
      [
        'input[name="_systemfield_location"]',
        'input[id="_systemfield_location"]',
        'input[name="location"]',
        '#location',
        'input[name="address"]',
      ],
      location,
      "Location",
      filledFields
    );
  }

  // Social & portfolio links
  const links = profile.links || {};
  if (links.linkedin || links.LinkedIn) {
    await fillIfPresent(
      page,
      [
        'input[name="_systemfield_urls_LinkedIn"]',
        'input[name*="linkedin" i]',
        'input[id*="linkedin" i]',
      ],
      links.linkedin || links.LinkedIn || "",
      "LinkedIn",
      filledFields
    );
  }

  if (links.portfolio || links.website) {
    await fillIfPresent(
      page,
      [
        'input[name="_systemfield_urls_Website"]',
        'input[name*="website" i]',
        'input[name*="portfolio" i]',
      ],
      links.portfolio || links.website || "",
      "Website",
      filledFields
    );
  }

  // Resume upload
  const resumeInput = await page.$(
    'input[type="file"][name="_systemfield_resume"], input[type="file"][name*="resume"], input[type="file"]'
  );
  if (resumeInput && resumePdfPath) {
    await resumeInput.setInputFiles(resumePdfPath);
    filledFields["Resume"] = "Uploaded tailored PDF";
  }

  // 5. Custom & Screening fields
  const skipPatterns = [
    /first.*name/i,
    /last.*name/i,
    /full.*name/i,
    /^name$/i,
    /email/i,
    /phone/i,
    /location/i,
    /linkedin|website|portfolio/i,
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

  // 6. Halt if unanswered required questions exist
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

  // 7. Screenshot after filling
  const filledScreenshot = await captureScreenshot("filled");
  const screenshotPaths: string[] = [filledScreenshot];

  // 8. CAPTCHA check after filling
  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: isDryRun,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA detected after filling Ashby form.",
    };
  }

  // 9. Dry Run Gate
  if (isDryRun) {
    return {
      success: true,
      dryRun: true,
      confirmationText:
        "[DRY RUN] Ashby form filled successfully - submission skipped per DRY_RUN mode.",
      filledFields,
      screenshotPaths,
    };
  }

  // 10. Live Submit
  const confirmationText = await submitAndConfirm({
    page,
    submitSelector:
      'button[type="submit"], button[data-qa="submit-button"], button:has-text("Submit Application"), button:has-text("Submit"), input[type="submit"]',
    confirmationSelector:
      '[data-qa="success-message"], .ashby-application-success, #application_confirmation',
  });

  if (await detectCaptcha(page)) {
    return {
      success: false,
      dryRun: false,
      filledFields,
      screenshotPaths,
      needsUser: true,
      needsUserReason: "Bot check or CAPTCHA triggered upon Ashby submission.",
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
