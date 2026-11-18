import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { readForm } from "../src/apply/readForm.ts";
import { applyGreenhouse } from "../src/apply/handlers/greenhouse.ts";
import { detectCaptcha } from "../src/apply/captcha.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Greenhouse Apply Agent", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;
  let dummyPdfPath: string;

  before(async () => {
    // 1. Create a dummy PDF file for testing upload
    dummyPdfPath = path.join(os.tmpdir(), `test-resume-${Date.now()}.pdf`);
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4\n%EOF");

    // 2. Start local HTTP server to serve test fixtures
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      let fixtureFile = "greenhouse.html";

      if (parsedUrl.pathname.includes("captcha")) {
        fixtureFile = "greenhouse-captcha.html";
      } else if (parsedUrl.pathname.includes("missing")) {
        fixtureFile = "greenhouse-missing-req.html";
      }

      const filePath = path.join(__dirname, "fixtures", fixtureFile);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 3. Launch browser
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (server) server.close();
    if (fs.existsSync(dummyPdfPath)) {
      try {
        fs.unlinkSync(dummyPdfPath);
      } catch {}
    }
  });

  test("readForm: lists every field with label, type, options, and required flag", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/greenhouse.html`);
      const fields = await readForm(page);

      assert.ok(fields.length >= 8, `Expected at least 8 fields, got ${fields.length}`);

      const firstNameField = fields.find((f) => f.label.toLowerCase().includes("first name"));
      assert.ok(firstNameField, "First Name field should be detected");
      assert.equal(firstNameField.type, "text");
      assert.equal(firstNameField.required, true);

      const emailField = fields.find((f) => f.label.toLowerCase().includes("email"));
      assert.ok(emailField, "Email field should be detected");
      assert.equal(emailField.type, "email");
      assert.equal(emailField.required, true);

      const resumeField = fields.find((f) => f.label.toLowerCase().includes("resume"));
      assert.ok(resumeField, "Resume field should be detected");
      assert.equal(resumeField.type, "file");
      assert.equal(resumeField.required, true);

      const workAuthField = fields.find((f) => f.label.toLowerCase().includes("authorized to work"));
      assert.ok(workAuthField, "Work authorization field should be detected");
      assert.equal(workAuthField.type, "select");
      assert.equal(workAuthField.required, true);
      assert.ok(workAuthField.options?.includes("Yes"));
      assert.ok(workAuthField.options?.includes("No"));
    } finally {
      await page.close();
    }
  });

  test("applyGreenhouse in DRY_RUN mode: fills form, saves proof, never clicks submit", async () => {
    process.env.DRY_RUN = "true";
    delete process.env.ALLOW_LIVE_SUBMIT;

    const page = await browser.newPage();
    let screenshotCount = 0;

    try {
      const result = await applyGreenhouse({
        page,
        url: `${serverUrl}/greenhouse.html`,
        profile: {
          name: "Ada Lovelace",
          phone: "+1-555-0100",
          city: "London, UK",
          links: { linkedin: "https://linkedin.com/in/ada-lovelace" },
          work_authorization: "Yes",
          needs_sponsorship: false,
          inbox_alias: "adalove1",
        },
        answers: [
          {
            question_key: "typescript_experience",
            question_text: "How many years of experience do you have with TypeScript?",
            answer: "5 years",
          },
        ],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async (name) => {
          screenshotCount++;
          return `screenshots/test/${name}.png`;
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.dryRun, true);
      assert.equal(result.submittedAt, undefined, "submitted_at must NOT be set in dry run");
      assert.ok(result.confirmationText?.includes("[DRY RUN]"));
      assert.equal(screenshotCount, 1, "Only filled screenshot should be taken in dry run");

      // Verify filled fields
      assert.equal(result.filledFields["First Name"], "Ada");
      assert.equal(result.filledFields["Last Name"], "Lovelace");
      assert.equal(result.filledFields["Email"], "adalove1@mail.qlam.app");
      assert.equal(result.filledFields["Phone"], "+1-555-0100");
      assert.equal(result.filledFields["Location"], "London, UK");
      assert.equal(result.filledFields["LinkedIn"], "https://linkedin.com/in/ada-lovelace");
      assert.equal(result.filledFields["Resume"], "Uploaded tailored PDF");

      // Verify form was NOT submitted in DOM
      const isConfirmationVisible = await page.$eval(
        "#application_confirmation",
        (el) => window.getComputedStyle(el).display !== "none"
      );
      assert.equal(isConfirmationVisible, false, "Form should NOT have been submitted in dry run");
    } finally {
      await page.close();
    }
  });

  test("applyGreenhouse in LIVE mode (DRY_RUN=false AND ALLOW_LIVE_SUBMIT=true): submits form and captures confirmation", async () => {
    process.env.DRY_RUN = "false";
    process.env.ALLOW_LIVE_SUBMIT = "true";

    const page = await browser.newPage();
    let screenshotCount = 0;

    try {
      const result = await applyGreenhouse({
        page,
        url: `${serverUrl}/greenhouse.html`,
        profile: {
          name: "Ada Lovelace",
          phone: "+1-555-0100",
          city: "London, UK",
          links: { linkedin: "https://linkedin.com/in/ada-lovelace" },
          work_authorization: "Yes",
          needs_sponsorship: false,
          inbox_alias: "adalove1",
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async (name) => {
          screenshotCount++;
          return `screenshots/test/${name}.png`;
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.dryRun, false);
      assert.ok(result.submittedAt, "submitted_at must be populated on live submit");
      assert.ok(result.confirmationText?.includes("Thank you for applying"));
      assert.equal(screenshotCount, 2, "Both filled and submitted screenshots should be taken");

      // Verify form was actually submitted in DOM
      const isConfirmationVisible = await page.$eval(
        "#application_confirmation",
        (el) => window.getComputedStyle(el).display !== "none"
      );
      assert.equal(isConfirmationVisible, true, "Confirmation div must be displayed on submit");
    } finally {
      await page.close();
      // Restore default dry-run env
      process.env.DRY_RUN = "true";
      delete process.env.ALLOW_LIVE_SUBMIT;
    }
  });

  test("Safety check: detects CAPTCHA and halts without solving or bypassing", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/greenhouse-captcha.html`);
      const hasCaptcha = await detectCaptcha(page);
      assert.equal(hasCaptcha, true, "Captcha should be detected");

      const result = await applyGreenhouse({
        page,
        url: `${serverUrl}/greenhouse-captcha.html`,
        profile: { inbox_alias: "adalove1" },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async () => "screenshots/test/dummy.png",
      });

      assert.equal(result.success, false);
      assert.equal(result.needsUser, true);
      assert.ok(result.needsUserReason?.toLowerCase().includes("captcha"));
    } finally {
      await page.close();
    }
  });

  test("Safety check: missing required question halts with needs_user (never guesses)", async () => {
    const page = await browser.newPage();
    try {
      const result = await applyGreenhouse({
        page,
        url: `${serverUrl}/greenhouse-missing-req.html`,
        profile: {
          name: "Ada Lovelace",
          inbox_alias: "adalove1",
        },
        answers: [], // No answer for the required custom question
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async () => "screenshots/test/dummy.png",
      });

      assert.equal(result.success, false);
      assert.equal(result.needsUser, true);
      assert.ok(result.needsUserReason?.includes("Missing required questions"));
      assert.ok(result.unansweredQuestions?.some((q) => q.includes("obscure programming language")));
    } finally {
      await page.close();
    }
  });
});
