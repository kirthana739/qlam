import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@qlam/core";
import { logApplyEvent } from "./logger.js";
import type { ApplyResult } from "./types.js";

export async function recordApplicationResult(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  userId: string,
  jobId: string,
  result: ApplyResult
): Promise<ApplyResult> {
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

  if (result.dryRun) {
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
