import fs from "node:fs";
import { chromium, type Browser } from "playwright";
import { getServiceClient } from "../utils/supabase.js";
import {
  detectAtsSystem,
  applyGreenhouse,
  applyLever,
  applyAshby,
} from "./handlers/index.js";
import { logApplyEvent } from "./logger.js";
import { downloadTailoredPdf } from "./pdf-helper.js";
import { recordApplicationResult } from "./result-recorder.js";
import { buildProfileContext } from "./profile-helper.js";
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

      // Detect ATS system from apply URL
      const atsDetection = detectAtsSystem(job.apply_url);
      if (!atsDetection.isSupported || !atsDetection.ats) {
        return {
          success: false,
          dryRun: true,
          filledFields: {},
          screenshotPaths: [],
          needsUser: true,
          needsUserReason:
            atsDetection.reason ||
            `Unsupported ATS URL or unknown job board domain "${atsDetection.hostname}".`,
        };
      }

      const profileContext = buildProfileContext(profile, parsedResume);
      const handlerOptions = {
        page,
        url: job.apply_url,
        profile: { ...profileContext, inbox_alias: profileContext.inbox_alias ?? "" },
        answers,
        job: {
          title: job.title,
          companyName: job.company_id || "Company",
          location: job.location,
          descriptionText: job.description_text,
        },
        resumePdfPath: tempPdfPath || "",
        captureScreenshot,
      };

      let runPromise: Promise<ApplyResult>;
      if (atsDetection.ats === "greenhouse") {
        runPromise = applyGreenhouse(handlerOptions);
      } else if (atsDetection.ats === "lever") {
        runPromise = applyLever(handlerOptions);
      } else {
        runPromise = applyAshby(handlerOptions);
      }

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

  return await recordApplicationResult(
    supabase,
    applicationId,
    userId,
    jobId,
    result
  );
}
