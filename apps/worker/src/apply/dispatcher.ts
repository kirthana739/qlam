import type { PgBoss } from "pg-boss";
import { getServiceClient } from "../utils/supabase.js";

/**
 * Polls for applications with run_status = 'queued' and enqueues
 * them to pg-boss. If no tailored resume PDF exists yet, enqueues
 * 'tailor-job' first. Once tailored, enqueues 'apply'.
 */
export async function checkQueuedApplications(boss: PgBoss): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Fetch queued applications
    const { data: queuedApps, error } = await supabase
      .from("applications")
      .select("id, user_id, job_id, tailored_resume_id")
      .eq("run_status", "queued")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error || !queuedApps || queuedApps.length === 0) {
      return;
    }

    for (const app of queuedApps) {
      // 1. Check if tailored resume exists with pdf_path
      const { data: tailored } = await supabase
        .from("tailored_resumes")
        .select("id, pdf_path")
        .eq("user_id", app.user_id)
        .eq("job_id", app.job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tailored || !tailored.pdf_path) {
        // Enqueue tailor-job first with singletonKey per application
        await boss.send(
          "tailor-job",
          {
            userId: app.user_id,
            jobId: app.job_id,
            applicationId: app.id,
          },
          { singletonKey: `tailor-${app.id}` }
        );
      } else {
        // Link tailored_resume_id if not yet linked
        if (!app.tailored_resume_id) {
          await supabase
            .from("applications")
            .update({ tailored_resume_id: tailored.id })
            .eq("id", app.id);
        }

        // Enqueue apply job with singletonKey per application
        await boss.send(
          "apply",
          {
            applicationId: app.id,
            userId: app.user_id,
            jobId: app.job_id,
          },
          { singletonKey: `apply-${app.id}` }
        );
      }
    }
  } catch (err) {
    console.error("[dispatcher] Error checking queued applications:", err instanceof Error ? err.message : err);
  }
}
