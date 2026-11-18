import fs from "node:fs";
import { chromium, type Browser } from "playwright";
import type { Json } from "@qlam/core";
import { getServiceClient } from "../utils/supabase.js";
import { applyGreenhouse } from "./handlers/greenhouse.js";
import { logApplyEvent } from "./logger.js";
import { downloadTailoredPdf } from "./pdf-helper.js";
import type { CandidateProfileContext } from "./answerEngine.js";
import type { ApplyJobData, ApplyResult } from "./types.js";

/**
 * Core runner for the "apply" pg-boss queue.
 */
export async function runApplyJob(jobData: ApplyJobData): Promise<ApplyResult> {
  const { applicationId } = jobData;
  const supabase = getServiceClient();

  // 1. Load application record
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    throw new Error(`Application ${applicationId} not found: ${appError?.message ?? "empty"}`);
  }

  const { user_id: userId, job_id: jobId } = application;

  // 1b. Load job record
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`Job ${jobId} not found for application ${applicationId}: ${jobError?.message ?? "empty"}`);
  }

  // If already submitted, skip
  if (application.run_status === "submitted") {
    console.log(`[apply-job] Application ${applicationId} is already submitted. Skipping.`);
    return {
      success: true,
      dryRun: application.dry_run ?? false,
      filledFields: (application.filled_fields as Record<string, string>) || {},
      screenshotPaths: application.screenshot_paths || [],
      submittedAt: application.submitted_at || undefined,
    };
  }

  // Update status to running and increment attempts
  await supabase
    .from("applications")
    .update({
      run_status: "running",
      attempts: (application.attempts || 0) + 1,
      error: null,
    })
    .eq("id", applicationId);

  await logApplyEvent(userId, "apply_started", {
    application_id: applicationId,
    job_id: jobId,
  });

  // 2. Load user profile
  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profError || !profile) {
    throw new Error(`Profile for user ${userId} not found: ${profError?.message ?? "empty"}`);
  }

  // 3. Load user answers bank and parsed resume facts
  const { data: answersData } = await supabase
    .from("answers")
    .select("question_key, question_text, answer, embedding")
    .eq("user_id", userId);

  const answers = answersData || [];

  const { data: resumeData } = await supabase
    .from("resumes")
    .select("parsed")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  const parsedResume = (resumeData?.parsed || {}) as Record<string, unknown>;

  // 4. Download tailored PDF to temp file
  const tempPdfPath = await downloadTailoredPdf(
    supabase,
    userId,
    jobId,
    application.tailored_resume_id
  );

  // Execute with retry: once, for timeouts only
  let attemptsRemaining = 2;
  let lastError: unknown = null;
  let result: ApplyResult | null = null;

  while (attemptsRemaining > 0) {
    attemptsRemaining--;
    let browser: Browser | null = null;
    let overallTimeoutTimer: NodeJS.Timeout | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();

      // Per-action ~30s timeout
      context.setDefaultTimeout(30_000);
      context.setDefaultNavigationTimeout(30_000);

      // Separate overall 5-minute timeout that closes the browser
      const timeoutPromise = new Promise<never>((_, reject) => {
        overallTimeoutTimer = setTimeout(async () => {
          try {
            await browser?.close();
          } catch {}
          reject(new Error("Overall 5-minute limit exceeded for apply job."));
        }, 300_000);
      });

      const page = await context.newPage();

      // Screenshot helper that writes to Supabase Storage
      const captureScreenshot = async (stepName: "filled" | "submitted"): Promise<string> => {
        const screenshotBuf = await page.screenshot({ fullPage: true });
        const storagePath = `${userId}/${applicationId}/${stepName}.png`;
        await supabase.storage
          .from("screenshots")
          .upload(storagePath, screenshotBuf, {
            contentType: "image/png",
            upsert: true,
          });
        return storagePath;
      };

      const runPromise = applyGreenhouse({
        page,
        url: job.apply_url,
        profile: {
          name: profile.name,
          phone: profile.phone,
          city: profile.city,
          links: profile.links as Record<string, string> | null,
          work_authorization: profile.work_authorization,
          needs_sponsorship: profile.needs_sponsorship,
          notice_period_days: profile.notice_period_days,
          expected_salary: profile.expected_salary,
          preferences: profile.preferences as Record<string, unknown> | null,
          skills: Array.isArray(parsedResume.skills) ? (parsedResume.skills as string[]) : undefined,
          experience: Array.isArray(parsedResume.experience)
            ? (parsedResume.experience as CandidateProfileContext["experience"])
            : undefined,
          education: Array.isArray(parsedResume.education)
            ? (parsedResume.education as CandidateProfileContext["education"])
            : undefined,
          summary: typeof parsedResume.summary === "string" ? parsedResume.summary : undefined,
          inbox_alias: profile.inbox_alias,
        },
        answers,
        job: {
          title: job.title,
          companyName: job.company_id || "Company",
          location: job.location,
          descriptionText: job.description_text,
        },
        resumePdfPath: tempPdfPath || "",
        captureScreenshot,
      });

      result = await Promise.race([runPromise, timeoutPromise]);
      break; // Success or graceful stop (e.g. needs_user)
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout =
        errMsg.toLowerCase().includes("timeout") ||
        errMsg.toLowerCase().includes("timed out");

      if (isTimeout && attemptsRemaining > 0) {
        console.warn(`[apply-job] Action timeout encountered. Retrying once...`);
        await logApplyEvent(userId, "apply_timeout_retry", {
          application_id: applicationId,
          error: errMsg,
        });
        continue;
      }
      break; // Non-timeout error or already retried
    } finally {
      if (overallTimeoutTimer) {
        clearTimeout(overallTimeoutTimer);
      }
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  // Clean up temp PDF
  if (tempPdfPath && fs.existsSync(tempPdfPath)) {
    try {
      fs.unlinkSync(tempPdfPath);
    } catch {}
  }

  // Handle errors
  if (!result) {
    const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
    await supabase
      .from("applications")
      .update({
        run_status: "failed",
        error: errorMsg,
      })
      .eq("id", applicationId);

    await logApplyEvent(userId, "apply_failed", {
      application_id: applicationId,
      error: errorMsg,
    });

    throw lastError || new Error("Apply job failed without result");
  }

  // Handle Needs User (e.g. CAPTCHA or missing required questions)
  if (result.needsUser) {
    await supabase
      .from("applications")
      .update({
        run_status: "needs_user",
        needs_user_reason: result.needsUserReason || "User intervention required",
        filled_fields: result.filledFields as unknown as Json,
        screenshot_paths: result.screenshotPaths,
      })
      .eq("id", applicationId);

    await logApplyEvent(userId, "apply_needs_user", {
      application_id: applicationId,
      reason: result.needsUserReason || "User intervention required",
      unanswered_questions: result.unansweredQuestions || [],
    });

    return result;
  }

  // Handle Dry Run vs Live Submit
  if (result.dryRun) {
    // Dry-run: do NOT set matches.status to 'applied', do NOT set submitted_at.
    await supabase
      .from("applications")
      .update({
        run_status: "submitted",
        dry_run: true,
        confirmation_text: result.confirmationText,
        filled_fields: result.filledFields as unknown as Json,
        screenshot_paths: result.screenshotPaths,
        error: null,
      })
      .eq("id", applicationId);

    await logApplyEvent(userId, "apply_dry_run_completed", {
      application_id: applicationId,
      field_count: Object.keys(result.filledFields).length,
    });
  } else {
    // Live submission
    await supabase
      .from("applications")
      .update({
        run_status: "submitted",
        dry_run: false,
        submitted_at: result.submittedAt || new Date().toISOString(),
        confirmation_text: result.confirmationText,
        filled_fields: result.filledFields as unknown as Json,
        screenshot_paths: result.screenshotPaths,
        error: null,
      })
      .eq("id", applicationId);

    // Update matches row to applied
    await supabase
      .from("matches")
      .update({ status: "applied" })
      .eq("user_id", userId)
      .eq("job_id", jobId);

    await logApplyEvent(userId, "apply_live_submitted", {
      application_id: applicationId,
      confirmation_text: result.confirmationText,
    });
  }

  return result;
}
