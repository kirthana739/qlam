import {
  tailorResume,
  generateCoverLetter,
  truthCheck,
  type ResumeData,
  type Preferences,
  type Json,
} from "@qlam/core";
import { getServiceClient } from "../utils/supabase.js";
import { renderResumePdf } from "./pdf-renderer.js";

export interface TailorJobData {
  userId: string;
  jobId: string;
  matchId?: string;
  applicationId?: string;
}

/**
 * Logs a structured event row into public.events.
 * Fire-and-forget – errors are only logged, never thrown.
 */
async function logEvent(
  userId: string,
  type: string,
  data: Json
): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("events").insert({ user_id: userId, type, data });
    if (error) {
      console.error(`[tailor-job] Failed to log event "${type}" for ${userId}:`, error.message);
    }
  } catch (err) {
    console.error(`[tailor-job] Unexpected error logging event "${type}":`, err);
  }
}

/**
 * Core handler for the "tailor-job" pg-boss queue.
 *
 * Steps:
 * 1. Load user's default resume + job details.
 * 2. AI-tailor the resume (tailorResume).
 * 3. Run pure-code truthCheck. If it fails → fall back to base resume,
 *    log a "truth_check_failed" event.
 * 4. AI-generate a cover letter (generateCoverLetter).
 * 5. Render PDF via Playwright.
 * 6. Upload PDF to Supabase Storage ("resumes" bucket).
 * 7. Upsert into tailored_resumes.
 * 8. Update matches.status → "queued" so the apply worker can proceed.
 */
export async function runTailorJob(data: TailorJobData): Promise<void> {
  const { userId, jobId, matchId } = data;
  const supabase = getServiceClient();

  // ---- 1. Load base resume ----
  const { data: resumes, error: resumeError } = await supabase
    .from("resumes")
    .select("id, parsed")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (resumeError || !resumes || resumes.length === 0) {
    throw new Error(`[tailor-job] No resume found for user ${userId}: ${resumeError?.message ?? "empty"}`);
  }

  const baseResumeRow = resumes[0]!;
  const baseResume = baseResumeRow.parsed as unknown as ResumeData;

  // ---- 1b. Load user preferences for tailoring_strength ----
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("user_id", userId)
    .single();

  const prefs = (profile?.preferences ?? {}) as Partial<Preferences>;
  const strength = prefs.tailoring_strength ?? "medium";
  const autoApprove = prefs.auto_approve_tailored ?? false;

  // ---- 1c. Load job ----
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, title, description_text, companies(name)")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`[tailor-job] Job ${jobId} not found: ${jobError?.message ?? "empty"}`);
  }

  // companies is a joined relation; Supabase returns it as an object or array
  const companyRow = Array.isArray(job.companies) ? job.companies[0] : job.companies;
  const companyName = (companyRow as { name?: string } | null)?.name ?? undefined;
  const jobTitle = job.title ?? "Software Engineer";
  const jobDescription = job.description_text ?? "";

  // ---- 2. AI tailoring ----
  let tailoredResume: ResumeData;
  let truthCheckOk = true;

  try {
    tailoredResume = await tailorResume({
      baseResume,
      jobTitle,
      jobDescription,
      companyName,
      strength,
    });
  } catch (err) {
    console.error(`[tailor-job] tailorResume failed for user ${userId} / job ${jobId}:`, err);
    // Fall back to base resume; mark truth check as failed so it's visible in UI
    tailoredResume = baseResume;
    truthCheckOk = false;
    await logEvent(userId, "truth_check_failed", {
      job_id: jobId,
      match_id: matchId,
      reason: "tailorResume threw an error",
      error: String(err),
    });
  }

  // ---- 3. Pure-code truth check ----
  if (truthCheckOk) {
    const checkResult = truthCheck(baseResume, tailoredResume);
    if (!checkResult.ok) {
      console.warn(
        `[tailor-job] Truth check failed for user ${userId} / job ${jobId}: ${checkResult.violations.join("; ")}`
      );
      truthCheckOk = false;
      tailoredResume = baseResume; // fall back to base
      await logEvent(userId, "truth_check_failed", {
        job_id: jobId,
        match_id: matchId,
        violations: checkResult.violations,
      });
    }
  }

  // ---- 4. Cover letter ----
  let coverLetterText: string | null = null;
  try {
    const clResult = await generateCoverLetter({
      baseResume,
      jobTitle,
      companyName,
      jobDescription,
    });
    coverLetterText = clResult.coverLetter;
  } catch (err) {
    console.error(`[tailor-job] generateCoverLetter failed for user ${userId} / job ${jobId}:`, err);
    // Non-fatal – proceed without a cover letter
  }

  // ---- 5. Render PDF ----
  let pdfPath: string | null = null;
  try {
    const pdfBuffer = await renderResumePdf(tailoredResume);

    // ---- 6. Upload to Supabase Storage ----
    const fileName = `tailored/${userId}/${jobId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[tailor-job] PDF upload failed for user ${userId} / job ${jobId}:`, uploadError.message);
    } else {
      pdfPath = fileName;
    }
  } catch (err) {
    console.error(`[tailor-job] PDF render/upload failed for user ${userId} / job ${jobId}:`, err);
    // Non-fatal – continue without PDF
  }

  // ---- 7. Upsert tailored_resumes ----
  const { data: upsertedResume, error: upsertError } = await supabase
    .from("tailored_resumes")
    .upsert(
      {
        user_id: userId,
        job_id: jobId,
        base_resume_id: baseResumeRow.id,
        content: tailoredResume as unknown as Json,
        pdf_path: pdfPath,
        approved: autoApprove,
        cover_letter: coverLetterText,
        truth_check_ok: truthCheckOk,
        tailoring_strength: strength,
      },
      { onConflict: "user_id,job_id" }
    )
    .select("id")
    .single();

  if (upsertError) {
    throw new Error(`[tailor-job] Failed to upsert tailored_resumes: ${upsertError.message}`);
  }

  // If this tailoring was triggered for an application, link the tailored_resume_id
  if (data.applicationId && upsertedResume?.id) {
    await supabase
      .from("applications")
      .update({ tailored_resume_id: upsertedResume.id })
      .eq("id", data.applicationId);
  } else if (upsertedResume?.id) {
    // Also check for any queued application for this user and job
    await supabase
      .from("applications")
      .update({ tailored_resume_id: upsertedResume.id })
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .eq("run_status", "queued");
  }

  // Note: match status is intentionally NOT changed here.
  // Only the Apply flow (a separate worker) transitions matches to "queued".

  console.log(
    `[tailor-job] Done – user ${userId} / job ${jobId} | truthCheckOk=${truthCheckOk} | pdf=${pdfPath ?? "none"}`
  );
}
