import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { readForm } from "../src/apply/readForm.js";
import { applyAshby } from "../src/apply/handlers/ashby.js";
import { detectCaptcha } from "../src/apply/captcha.js";
import { setMockStagehandLocator } from "../src/apply/handlers/stagehand-fallback.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Ashby Apply Agent", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;
  let dummyPdfPath: string;

  before(async () => {
    dummyPdfPath = path.join(os.tmpdir(), `test-ashby-resume-${Date.now()}.pdf`);
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4\n%EOF");

    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      let fixtureFile = "ashby.html";

      if (parsedUrl.pathname.includes("captcha")) {
        fixtureFile = "ashby-captcha.html";
      } else if (parsedUrl.pathname.includes("missing")) {
        fixtureFile = "ashby-missing-req.html";
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
    setMockStagehandLocator(null);
  });

  test("readForm: extracts Ashby _systemfield_* inputs and screening questions", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/ashby.html`);
      const fields = await readForm(page);

      assert.ok(fields.length >= 7, `Expected at least 7 fields, got ${fields.length}`);

      const nameField = fields.find((f) => f.name === "_systemfield_name" || f.label.toLowerCase().includes("full name"));
      assert.ok(nameField, "_systemfield_name field should be detected");
      assert.equal(nameField.required, true);

      const emailField = fields.find((f) => f.name === "_systemfield_email");
      assert.ok(emailField, "_systemfield_email field should be detected");
      assert.equal(emailField.required, true);

      const phoneField = fields.find((f) => f.name === "_systemfield_phone");
      assert.ok(phoneField, "_systemfield_phone field should be detected");
      assert.equal(phoneField.required, true);

      const locationField = fields.find((f) => f.name === "_systemfield_location");
      assert.ok(locationField, "_systemfield_location field should be detected");
      assert.equal(locationField.required, true);

      const resumeField = fields.find((f) => f.name === "_systemfield_resume");
      assert.ok(resumeField, "_systemfield_resume field should be detected");
      assert.equal(resumeField.type, "file");
      assert.equal(resumeField.required, true);
    } finally {
      await page.close();
    }
  });

  test("applyAshby in DRY_RUN mode: fills system fields and demographics, never submits", async () => {
    const page = await browser.newPage();
    const prevDryRun = process.env.DRY_RUN;
    const prevAllowLive = process.env.ALLOW_LIVE_SUBMIT;

    delete process.env.DRY_RUN;
    delete process.env.ALLOW_LIVE_SUBMIT;

    const screenshotCalls: string[] = [];
    const mockCaptureScreenshot = async (name: "filled" | "submitted") => {
      screenshotCalls.push(name);
      return `screenshots/ashby/${name}.png`;
    };

    try {
      const result = await applyAshby({
        page,
        url: `${serverUrl}/ashby.html`,
        profile: {
          name: "Alex Cloud",
          phone: "+15554567890",
          city: "Seattle, WA",
          work_authorization: "authorized",
          needs_sponsorship: false,
          inbox_alias: "alex.cloud",
          links: {
            linkedin: "https://linkedin.com/in/alexcloud",
            website: "https://alexcloud.io",
          },
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: mockCaptureScreenshot,
      });

      assert.equal(result.success, true);
      assert.equal(result.dryRun, true);
      assert.ok(result.confirmationText?.includes("[DRY RUN]"));
      assert.equal(screenshotCalls.includes("filled"), true);
      assert.equal(screenshotCalls.includes("submitted"), false);

      assert.equal(result.filledFields["Full Name"], "Alex Cloud");
      assert.equal(result.filledFields["Email"], "alex.cloud@mail.qlam.app");
      assert.equal(result.filledFields["Phone"], "+15554567890");
      assert.equal(result.filledFields["Location"], "Seattle, WA");
      assert.equal(result.filledFields["LinkedIn"], "https://linkedin.com/in/alexcloud");
      assert.equal(result.filledFields["Website"], "https://alexcloud.io");
      assert.equal(result.filledFields["Resume"], "Uploaded tailored PDF");

      // Verify ethnicity defaulted to Decline to self-identify
      const ethnicityVal = await page.$eval("#ethnicity", (el) => (el as HTMLSelectElement).value);
      assert.equal(ethnicityVal, "Decline to self-identify");

      // Verify form was not submitted
      const confirmationVisible = await page.$eval(
        "#application_confirmation",
        (el) => getComputedStyle(el).display !== "none"
      );
      assert.equal(confirmationVisible, false, "Form should not be submitted in dry-run mode");
    } finally {
      await page.close();
      if (prevDryRun !== undefined) process.env.DRY_RUN = prevDryRun;
      if (prevAllowLive !== undefined) process.env.ALLOW_LIVE_SUBMIT = prevAllowLive;
    }
  });

  test("applyAshby in LIVE mode: submits form and captures confirmation", async () => {
    const page = await browser.newPage();
    process.env.DRY_RUN = "false";
    process.env.ALLOW_LIVE_SUBMIT = "true";

    const screenshotCalls: string[] = [];
    const mockCaptureScreenshot = async (name: "filled" | "submitted") => {
      screenshotCalls.push(name);
      return `screenshots/ashby/${name}.png`;
    };

    try {
      const result = await applyAshby({
        page,
        url: `${serverUrl}/ashby.html`,
        profile: {
          name: "Morgan Taylor",
          phone: "+15550001122",
          city: "Austin, TX",
          work_authorization: "authorized",
          needs_sponsorship: false,
          inbox_alias: "morgan.taylor",
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: mockCaptureScreenshot,
      });

      assert.equal(result.success, true);
      assert.equal(result.dryRun, false);
      assert.ok(result.confirmationText?.includes("Application submitted successfully"));
      assert.equal(screenshotCalls.includes("filled"), true);
      assert.equal(screenshotCalls.includes("submitted"), true);

      const confirmationVisible = await page.$eval(
        "#application_confirmation",
        (el) => getComputedStyle(el).display !== "none"
      );
      assert.equal(confirmationVisible, true, "Confirmation screen should be visible");
    } finally {
      await page.close();
      delete process.env.DRY_RUN;
      delete process.env.ALLOW_LIVE_SUBMIT;
    }
  });

  test("Safety check: detects CAPTCHA on Ashby and halts without solving", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/ashby-captcha.html`);
      const hasCaptcha = await detectCaptcha(page);
      assert.equal(hasCaptcha, true, "CAPTCHA element should be detected");

      const result = await applyAshby({
        page,
        url: `${serverUrl}/ashby-captcha.html`,
        profile: {
          name: "Test User",
          inbox_alias: "test.user",
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async () => "",
      });

      assert.equal(result.success, false);
      assert.equal(result.needsUser, true);
      assert.ok(result.needsUserReason?.toLowerCase().includes("captcha"));
    } finally {
      await page.close();
    }
  });

  test("Safety check: missing required question on Ashby halts with needs_user", async () => {
    const page = await browser.newPage();
    try {
      const result = await applyAshby({
        page,
        url: `${serverUrl}/ashby-missing-req.html`,
        profile: {
          name: "Test User",
          inbox_alias: "test.user",
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async () => "",
      });

      assert.equal(result.success, false);
      assert.equal(result.needsUser, true);
      assert.ok(result.unansweredQuestions?.some((q) => q.toLowerCase().includes("patents")));
    } finally {
      await page.close();
    }
  });

  test("Stagehand fallback: uses mock Stagehand locator to find element when selector fails", async () => {
    const page = await browser.newPage();

    setMockStagehandLocator(async (_p, label) => {
      if (label.toLowerCase().includes("authorized to work")) {
        return "#work_auth";
      }
      return null;
    });

    try {
      const result = await applyAshby({
        page,
        url: `${serverUrl}/ashby.html`,
        profile: {
          name: "Fallback Candidate",
          inbox_alias: "fallback.cand",
          work_authorization: "authorized",
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: async () => "",
      });

      assert.equal(result.success, true);
      assert.equal(result.filledFields["Full Name"], "Fallback Candidate");
    } finally {
      setMockStagehandLocator(null);
      await page.close();
    }
  });
});
