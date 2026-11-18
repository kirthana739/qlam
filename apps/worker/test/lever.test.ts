import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { readForm } from "../src/apply/readForm.js";
import { applyLever } from "../src/apply/handlers/lever.js";
import { detectCaptcha } from "../src/apply/captcha.js";
import { setMockStagehandLocator } from "../src/apply/handlers/stagehand-fallback.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Lever Apply Agent", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;
  let dummyPdfPath: string;

  before(async () => {
    dummyPdfPath = path.join(os.tmpdir(), `test-lever-resume-${Date.now()}.pdf`);
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4\n%EOF");

    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      let fixtureFile = "lever.html";

      if (parsedUrl.pathname.includes("captcha")) {
        fixtureFile = "lever-captcha.html";
      } else if (parsedUrl.pathname.includes("missing")) {
        fixtureFile = "lever-missing-req.html";
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

  test("readForm: extracts Lever fields including custom cards and selects", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/lever.html`);
      const fields = await readForm(page);

      assert.ok(fields.length >= 7, `Expected at least 7 fields, got ${fields.length}`);

      const nameField = fields.find((f) => f.name === "name" || f.label.toLowerCase().includes("full name"));
      assert.ok(nameField, "Full Name field should be detected");
      assert.equal(nameField.required, true);

      const emailField = fields.find((f) => f.name === "email");
      assert.ok(emailField, "Email field should be detected");
      assert.equal(emailField.required, true);

      const resumeField = fields.find((f) => f.name === "resume");
      assert.ok(resumeField, "Resume field should be detected");
      assert.equal(resumeField.type, "file");
      assert.equal(resumeField.required, true);

      const workAuthField = fields.find((f) => f.label.toLowerCase().includes("authorized to work"));
      assert.ok(workAuthField, "Work auth field should be detected");
      assert.equal(workAuthField.type, "select");
      assert.equal(workAuthField.required, true);
    } finally {
      await page.close();
    }
  });

  test("applyLever in DRY_RUN mode: fills form, defaults demographics to decline, leaves comments empty when unbanked, never submits", async () => {
    const page = await browser.newPage();
    const prevDryRun = process.env.DRY_RUN;
    const prevAllowLive = process.env.ALLOW_LIVE_SUBMIT;

    delete process.env.DRY_RUN;
    delete process.env.ALLOW_LIVE_SUBMIT;

    const screenshotCalls: string[] = [];
    const mockCaptureScreenshot = async (name: "filled" | "submitted") => {
      screenshotCalls.push(name);
      return `screenshots/lever/${name}.png`;
    };

    try {
      const result = await applyLever({
        page,
        url: `${serverUrl}/lever.html`,
        profile: {
          name: "Jane Developer",
          phone: "+15551234567",
          city: "San Francisco, CA",
          work_authorization: "authorized",
          needs_sponsorship: false,
          inbox_alias: "jane.dev",
          experience: [{ company: "Acme Global", position: "Senior Engineer" }],
          links: {
            linkedin: "https://linkedin.com/in/janedev",
            portfolio: "https://janedev.com",
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

      // Verify filled fields
      assert.equal(result.filledFields["Full Name"], "Jane Developer");
      assert.equal(result.filledFields["Email"], "jane.dev@mail.qlam.app");
      assert.equal(result.filledFields["Phone"], "+15551234567");
      assert.equal(result.filledFields["Current Company"], "Acme Global");
      assert.equal(result.filledFields["LinkedIn"], "https://linkedin.com/in/janedev");
      assert.equal(result.filledFields["Portfolio"], "https://janedev.com");
      assert.equal(result.filledFields["Resume"], "Uploaded tailored PDF");

      // Verify demographic defaulted to Decline to self-identify
      const genderVal = await page.$eval("#gender", (el) => (el as HTMLSelectElement).value);
      assert.equal(genderVal, "Decline to self-identify");

      // Verify comments textarea remained empty
      const commentsVal = await page.$eval("#comments", (el) => (el as HTMLTextAreaElement).value);
      assert.equal(commentsVal, "");

      // Verify form was never submitted
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

  test("applyLever in LIVE mode: submits form and captures confirmation", async () => {
    const page = await browser.newPage();
    process.env.DRY_RUN = "false";
    process.env.ALLOW_LIVE_SUBMIT = "true";

    const screenshotCalls: string[] = [];
    const mockCaptureScreenshot = async (name: "filled" | "submitted") => {
      screenshotCalls.push(name);
      return `screenshots/lever/${name}.png`;
    };

    try {
      const result = await applyLever({
        page,
        url: `${serverUrl}/lever.html`,
        profile: {
          name: "John Doe",
          phone: "+15559876543",
          city: "New York, NY",
          work_authorization: "authorized",
          needs_sponsorship: false,
          inbox_alias: "john.doe",
          experience: [{ company: "Tech Innovations" }],
        },
        answers: [],
        resumePdfPath: dummyPdfPath,
        captureScreenshot: mockCaptureScreenshot,
      });

      assert.equal(result.success, true);
      assert.equal(result.dryRun, false);
      assert.ok(result.confirmationText?.includes("Thank you for applying"));
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

  test("Safety check: detects CAPTCHA on Lever and halts without solving", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${serverUrl}/lever-captcha.html`);
      const hasCaptcha = await detectCaptcha(page);
      assert.equal(hasCaptcha, true, "CAPTCHA element should be detected");

      const result = await applyLever({
        page,
        url: `${serverUrl}/lever-captcha.html`,
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

  test("Safety check: missing required question on Lever halts with needs_user", async () => {
    const page = await browser.newPage();
    try {
      const result = await applyLever({
        page,
        url: `${serverUrl}/lever-missing-req.html`,
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
      assert.ok(result.unansweredQuestions?.some((q) => q.toLowerCase().includes("clearance")));
    } finally {
      await page.close();
    }
  });

  test("Stagehand fallback: uses mock Stagehand locator to find element when selector fails", async () => {
    const page = await browser.newPage();

    // Set mock Stagehand locator to locate the work_auth select
    setMockStagehandLocator(async (_p, label) => {
      if (label.toLowerCase().includes("authorized to work")) {
        return "#work_auth";
      }
      return null;
    });

    try {
      const result = await applyLever({
        page,
        url: `${serverUrl}/lever.html`,
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
