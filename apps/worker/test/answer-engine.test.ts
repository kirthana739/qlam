import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { isLegalOrEligibilityQuestion, classifyLegalCategory } from "../src/apply/legalClassifier.ts";
import {
  resolveFieldAnswer,
  matchOption,
  type BankAnswer,
  type CandidateProfileContext,
} from "../src/apply/answerEngine.ts";
import { applyGreenhouse } from "../src/apply/handlers/greenhouse.ts";
import type { FormField } from "../src/apply/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Step 7b: Answer Engine & Legal Guardrails", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;
  let dummyPdfPath: string;

  before(async () => {
    dummyPdfPath = path.join(os.tmpdir(), `test-resume-7b-${Date.now()}.pdf`);
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4\n%EOF");

    // Local HTTP server serving HTML fixtures
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      let fixtureName = "greenhouse-custom-8.html";

      if (parsedUrl.pathname.includes("greenhouse.html")) {
        fixtureName = "greenhouse.html";
      }

      const filePath = path.join(__dirname, "fixtures", fixtureName);
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
  });

  describe("1. Legal and Eligibility Question Classifier", () => {
    test("accurately identifies all required legal and eligibility categories", () => {
      assert.equal(
        isLegalOrEligibilityQuestion("Are you legally authorized to work in the United States?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("Will you now or in the future require visa sponsorship?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("Have you ever been convicted of a criminal felony or misdemeanor?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("Are you at least 18 years of age or older?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("Do you have a physical disability or handicap?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("What is your gender identity?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("What is your race and ethnicity?"),
        true
      );
      assert.equal(
        isLegalOrEligibilityQuestion("What is your military veteran status?"),
        true
      );
    });

    test("does not falsely flag non-legal technical or skill questions", () => {
      assert.equal(
        isLegalOrEligibilityQuestion("How many years of TypeScript experience do you have?"),
        false
      );
      assert.equal(
        isLegalOrEligibilityQuestion("What is your preferred work style arrangement?"),
        false
      );
      assert.equal(
        isLegalOrEligibilityQuestion("What is your personal portfolio or GitHub URL?"),
        false
      );
      assert.equal(
        isLegalOrEligibilityQuestion("Describe a complex distributed system you designed."),
        false
      );
    });
  });

  describe("2. Resolution Cascade & Guardrail Rules", () => {
    const profile: CandidateProfileContext = {
      name: "Ada Lovelace",
      work_authorization: "Yes",
      needs_sponsorship: false,
      expected_salary: "$140,000",
      links: { github: "https://github.com/adalove" },
    };

    const job = {
      title: "Senior Engineer",
      companyName: "Acme Corp",
    };

    test("Priority 1: Matches answer from Bank by exact key or question text", async () => {
      const field: FormField = {
        name: "years_ts",
        label: "Years with TypeScript",
        type: "text",
        required: true,
        selector: "#years_ts",
      };

      const bank: BankAnswer[] = [
        {
          question_key: "years_ts",
          question_text: "How many years of TypeScript do you have?",
          answer: "6 years",
        },
      ];

      const res = await resolveFieldAnswer({ field, answers: bank, profile, job });
      assert.equal(res.source, "bank");
      assert.equal(res.answer, "6 years");
      assert.equal(res.confidence, 1.0);
    });

    test("Priority 1b: Matches answer from Bank by embedding similarity (>= 0.85)", async () => {
      const field: FormField = {
        label: "How long have you been coding in TypeScript professionally?",
        type: "text",
        required: true,
        selector: "#ts_coding",
      };

      // Vector dimension 4 for test
      const bank: BankAnswer[] = [
        {
          question_key: "ts_exp",
          question_text: "Years of professional TypeScript programming experience",
          answer: "7 years",
          embedding: [1, 0, 0, 0],
        },
      ];

      const res = await resolveFieldAnswer({
        field,
        answers: bank,
        profile,
        job,
        embedFn: async () => [0.99, 0.05, 0, 0], // Cosine sim ~0.99
      });

      assert.equal(res.source, "bank");
      assert.equal(res.answer, "7 years");
      assert.ok(res.confidence >= 0.85);
    });

    test("Priority 2: Resolves from Profile mapping table when absent from bank", async () => {
      const field: FormField = {
        label: "Are you legally authorized to work in the United States?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
        selector: "#work_auth",
      };

      const res = await resolveFieldAnswer({
        field,
        answers: [],
        profile,
        job,
      });

      assert.equal(res.source, "profile");
      assert.equal(res.answer, "Yes");
      assert.equal(res.confidence, 1.0);
    });

    test("Priority 3: Legal questions NEVER go to AI when unbanked and unmapped", async () => {
      let aiCalled = false;

      const criminalField: FormField = {
        label: "Have you ever been convicted of a criminal felony?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
        selector: "#criminal",
      };

      const res = await resolveFieldAnswer({
        field: criminalField,
        answers: [],
        profile: { ...profile, work_authorization: null },
        job,
        aiGenerateFn: async () => {
          aiCalled = true;
          return { answer: "No", confidence: 0.9, usedFacts: [] };
        },
      });

      assert.equal(aiCalled, false, "AI must NEVER be invoked for legal/eligibility questions");
      assert.equal(res.answer, null);
      assert.equal(res.confidence, 0);
      assert.equal(res.isLegalOrEligibility, true);
    });

    test("Priority 4: Technical question with grounded facts resolves via AI", async () => {
      let aiCalled = false;

      const field: FormField = {
        label: "How many years of professional TypeScript experience do you have?",
        type: "text",
        required: true,
        selector: "#ts_field",
      };

      const res = await resolveFieldAnswer({
        field,
        answers: [],
        profile: {
          ...profile,
          skills: ["TypeScript", "Node.js"],
          experience: [
            {
              position: "Senior Full-Stack Engineer",
              company: "Tech Co",
              startDate: "2019-01",
              endDate: "Present",
              description: "5 years building TypeScript cloud applications.",
            },
          ],
        },
        job,
        aiGenerateFn: async () => {
          aiCalled = true;
          return {
            answer: "5 years",
            confidence: 0.95,
            usedFacts: ["Tech Co senior role with 5 years TypeScript"],
          };
        },
      });

      assert.equal(aiCalled, true);
      assert.equal(res.source, "ai");
      assert.equal(res.answer, "5 years");
      assert.ok(res.confidence >= 0.8);
    });

    test("Low confidence (<0.8) without facts flags field as needing user", async () => {
      const field: FormField = {
        label: "Have you ever operated an orbital particle accelerator?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
        selector: "#accelerator",
      };

      const res = await resolveFieldAnswer({
        field,
        answers: [],
        profile,
        job,
        aiGenerateFn: async () => ({
          answer: "No",
          confidence: 0.3, // Low confidence: no facts found in profile
          usedFacts: [],
        }),
      });

      assert.equal(res.source, "ai");
      assert.ok(res.confidence < 0.8, "Confidence must be strictly below 0.8");
    });
  });

  describe("3. End-to-End Fixture Test: 8 Custom Questions (Run 1 -> User Answers -> Run 2)", () => {
    test("Run 1 halts with needs_user on unbanked legal and low-confidence questions; Run 2 completes cleanly", async () => {
      process.env.DRY_RUN = "true";
      delete process.env.ALLOW_LIVE_SUBMIT;

      const userProfile: CandidateProfileContext = {
        name: "Ada Lovelace",
        phone: "+1-555-0199",
        city: "San Francisco, CA",
        work_authorization: "Yes",
        needs_sponsorship: false,
        links: {
          portfolio: "https://ada-lovelace.dev",
          github: "https://github.com/adalove",
        },
        preferences: {
          work_mode: "Remote",
        },
        skills: ["TypeScript", "PostgreSQL"],
        inbox_alias: "adalove7b",
      };

      // Initial Answers Bank: only contains veteran status
      const userAnswersBank: BankAnswer[] = [
        {
          question_key: "veteran_status",
          question_text: "What is your military veteran status?",
          answer: "I am not a protected veteran",
        },
      ];

      // AI simulation function
      const aiGenerateFn = async (prompt: string) => {
        if (prompt.includes("TypeScript experience")) {
          return {
            answer: "5 years",
            confidence: 0.95,
            usedFacts: ["Verified 5 years professional TypeScript programming"],
          };
        }
        // Obscure orbital accelerator question has no facts -> low confidence
        return {
          answer: "No",
          confidence: 0.25,
          usedFacts: [],
        };
      };

      // --- RUN 1: INITIAL ATTEMPT ---
      const page1 = await browser.newPage();
      let result1;

      try {
        result1 = await applyGreenhouse({
          page: page1,
          url: `${serverUrl}/greenhouse-custom-8.html`,
          profile: userProfile,
          answers: userAnswersBank,
          resumePdfPath: dummyPdfPath,
          captureScreenshot: async (name) => `screenshots/test/${name}.png`,
          aiGenerateFn,
        });

        // Assert Run 1 halts with needsUser = true
        assert.equal(result1.success, false, "Run 1 must NOT succeed");
        assert.equal(result1.needsUser, true, "Run 1 must flag needsUser");
        assert.ok(result1.needsUserReason?.includes("Missing required questions"));

        // Question 3 (Criminal record - legal) and Question 8 (Accelerator - low conf) must need user
        assert.ok(
          result1.unansweredQuestions?.some((q) => q.includes("criminal felony")),
          "Criminal record question must be in unanswered questions"
        );
        assert.ok(
          result1.unansweredQuestions?.some((q) => q.includes("orbital particle accelerator")),
          "Particle accelerator question must be in unanswered questions"
        );

        // Standard and high-confidence fields must have been filled
        assert.equal(result1.filledFields["First Name"], "Ada");
        assert.equal(result1.filledFields["Last Name"], "Lovelace");
        assert.equal(result1.filledFields["Are you legally authorized to work in the United States?"], "Yes");
        assert.equal(result1.filledFields["Will you now or in the future require visa sponsorship?"], "No");
        assert.equal(result1.filledFields["What is your military veteran status?"], "I am not a protected veteran");
        assert.equal(result1.filledFields["How many years of professional TypeScript experience do you have?"], "5 years");
        assert.equal(result1.filledFields["What is your preferred work style arrangement?"], "Remote");
        assert.equal(result1.filledFields["What is your personal portfolio or GitHub URL?"], "https://github.com/adalove");

        // Form was NOT submitted
        const isSubmitted1 = await page1.$eval(
          "#application_confirmation",
          (el) => window.getComputedStyle(el).display !== "none"
        );
        assert.equal(isSubmitted1, false, "Form must NOT be submitted during Run 1");
      } finally {
        await page1.close();
      }

      // --- USER ANSWERS THE MISSING QUESTIONS (Saved to Answers Bank) ---
      userAnswersBank.push(
        {
          question_key: "criminal_record",
          question_text: "Have you ever been convicted of a criminal felony?",
          answer: "No",
        },
        {
          question_key: "orbital_accelerator",
          question_text: "Have you ever operated an orbital particle accelerator?",
          answer: "No",
        }
      );

      // --- RUN 2: RE-RUN APPLICATION ---
      const page2 = await browser.newPage();
      let result2;

      try {
        result2 = await applyGreenhouse({
          page: page2,
          url: `${serverUrl}/greenhouse-custom-8.html`,
          profile: userProfile,
          answers: userAnswersBank,
          resumePdfPath: dummyPdfPath,
          captureScreenshot: async (name) => `screenshots/test/${name}.png`,
          aiGenerateFn,
        });

        // Assert Run 2 completes cleanly without asking again
        assert.equal(result2.success, true, "Run 2 must succeed");
        assert.equal(result2.dryRun, true, "Run 2 must run in DRY_RUN mode");
        assert.equal(result2.needsUser, undefined, "Run 2 must NOT ask the user again");
        assert.ok(result2.confirmationText?.includes("[DRY RUN]"));

        // All 8 custom fields must now be filled!
        assert.equal(result2.filledFields["Are you legally authorized to work in the United States?"], "Yes");
        assert.equal(result2.filledFields["Will you now or in the future require visa sponsorship?"], "No");
        assert.equal(result2.filledFields["Have you ever been convicted of a criminal felony?"], "No");
        assert.equal(result2.filledFields["What is your military veteran status?"], "I am not a protected veteran");
        assert.equal(result2.filledFields["How many years of professional TypeScript experience do you have?"], "5 years");
        assert.equal(result2.filledFields["What is your preferred work style arrangement?"], "Remote");
        assert.equal(result2.filledFields["What is your personal portfolio or GitHub URL?"], "https://github.com/adalove");
        assert.equal(result2.filledFields["Have you ever operated an orbital particle accelerator?"], "No");

        // Verify that proof screenshot was taken
        assert.equal(result2.screenshotPaths.length, 1);
        assert.ok(result2.screenshotPaths[0]?.includes("filled.png"));
      } finally {
        await page2.close();
      }
    });
  });
});
