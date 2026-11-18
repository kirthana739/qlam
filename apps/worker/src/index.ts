import process from "node:process";
import { PgBoss, type Job } from "pg-boss";
import { getServiceClient } from "./utils/supabase.js";
import { syncCompany } from "./sync/sync-company.js";
import { runMatchUser } from "./matching/match-user.js";
import { runTailorJob, type TailorJobData } from "./tailoring/tailor-job.js";
import { runApplyJob } from "./apply/apply-job.js";
import { checkQueuedApplications } from "./apply/dispatcher.js";
import type { ApplyJobData } from "./apply/types.js";

// Attempt to load .env using Node 22 built-in if not already populated
try {
  process.loadEnvFile?.();
} catch {
  // .env may already be loaded via CLI flag or container environment
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL in environment variables.");
}

interface SyncCompanyData {
  companyId: string;
}

interface MatchUserData {
  userId: string;
}

async function checkRequestedSyncs(boss: PgBoss) {
  try {
    const supabase = getServiceClient();
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, last_synced_at, sync_requested_at")
      .eq("active", true)
      .not("sync_requested_at", "is", null);

    if (error || !companies) {
      return;
    }

    for (const c of companies) {
      if (!c.sync_requested_at) continue;

      const isNewer =
        !c.last_synced_at ||
        new Date(c.sync_requested_at).getTime() > new Date(c.last_synced_at).getTime();

      if (isNewer) {
        await boss.send("sync-company", { companyId: c.id });
      }
    }
  } catch (err) {
    console.error("Error checking requested syncs:", err);
  }
}

async function checkRequestedMatches(boss: PgBoss) {
  try {
    const supabase = getServiceClient();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, last_matched_at, match_requested_at")
      .eq("onboarding_done", true)
      .not("match_requested_at", "is", null);

    if (error || !profiles) {
      return;
    }

    for (const p of profiles) {
      if (!p.match_requested_at) continue;

      const isNewer =
        !p.last_matched_at ||
        new Date(p.match_requested_at).getTime() > new Date(p.last_matched_at).getTime();

      if (isNewer) {
        // Enqueue with singletonKey per user to prevent duplicate jobs
        await boss.send(
          "match-user",
          { userId: p.user_id },
          { singletonKey: `match-user-${p.user_id}` }
        );
      }
    }
  } catch (err) {
    console.error("Error checking requested user matches:", err);
  }
}

async function main() {
  console.log("Starting Qlam worker...");
  const boss = new PgBoss({
    connectionString,
    max: 10,
  });

  boss.on("error", (error) => console.error("pg-boss error:", error));

  await boss.start();
  console.log("pg-boss started successfully.");

  const queues = [
    "sync-jobs",
    "check-requested-syncs",
    "sync-company",
    "match-users-daily",
    "check-requested-matches",
    "match-user",
    "tailor-job",
    "apply",
    "check-queued-applications",
  ];

  for (const queue of queues) {
    await boss.createQueue(queue);
  }

  // Cron schedules
  await boss.schedule("sync-jobs", "0 */6 * * *");
  await boss.schedule("check-requested-syncs", "* * * * *");
  await boss.schedule("match-users-daily", "0 2 * * *");
  await boss.schedule("check-requested-matches", "* * * * *");
  await boss.schedule("check-queued-applications", "* * * * *");

  // Also run fast polling interval (every 5 seconds) for snappy UX
  const queuedAppsInterval = setInterval(() => {
    checkQueuedApplications(boss).catch((err) => {
      console.error("Fast polling checkQueuedApplications failed:", err);
    });
  }, 5000);

  // Worker for sync-jobs: enqueues sync-company for each active company
  await boss.work("sync-jobs", async () => {
    console.log("Executing scheduled sync-jobs...");
    const supabase = getServiceClient();
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id")
      .eq("active", true);

    if (error) {
      console.error("Failed to query active companies:", error);
      return;
    }

    for (const company of companies || []) {
      await boss.send("sync-company", { companyId: company.id });
    }
    console.log(`Enqueued sync-company for ${companies?.length || 0} companies.`);
  });

  // Worker for check-requested-syncs
  await boss.work("check-requested-syncs", async () => {
    await checkRequestedSyncs(boss);
  });

  // Worker for individual company sync with concurrency 3
  await boss.work(
    "sync-company",
    { localConcurrency: 3, batchSize: 1 },
    async (jobs: Job<SyncCompanyData>[]) => {
      for (const job of jobs) {
        const { companyId } = job.data;
        console.log(`Syncing company ${companyId}...`);
        try {
          const result = await syncCompany(companyId);
          console.log(
            `Company ${companyId} synced: ${result.totalSynced} total, ${result.newOrUpdated} new/updated, ${result.closed} closed.`
          );
        } catch (err) {
          console.error(`Error syncing company ${companyId}:`, err);
          throw err;
        }
      }
    }
  );

  // Worker for daily match-users: finds all onboarded users and enqueues match-user
  await boss.work("match-users-daily", async () => {
    console.log("Executing scheduled match-users-daily...");
    const supabase = getServiceClient();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("onboarding_done", true);

    if (error) {
      console.error("Failed to query onboarded profiles for daily match:", error);
      return;
    }

    for (const profile of profiles || []) {
      await boss.send(
        "match-user",
        { userId: profile.user_id },
        { singletonKey: `match-user-${profile.user_id}` }
      );
    }
    console.log(`Enqueued match-user for ${profiles?.length || 0} users.`);
  });

  // Worker for check-requested-matches: triggers on profile edit
  await boss.work("check-requested-matches", async () => {
    await checkRequestedMatches(boss);
  });

  // Worker for individual user matching
  await boss.work(
    "match-user",
    { localConcurrency: 2, batchSize: 1 },
    async (jobs: Job<MatchUserData>[]) => {
      for (const job of jobs) {
        const { userId } = job.data;
        console.log(`Running match-user job for user ${userId}...`);
        try {
          const result = await runMatchUser(userId);
          console.log(
            `match-user finished for ${userId}: scored ${result.scoredCount} jobs (skipped: ${result.skipped}${
              result.reason ? `, reason: ${result.reason}` : ""
            }).`
          );
        } catch (err) {
          console.error(`Error running match-user for ${userId}:`, err);
          throw err;
        }
      }
    }
  );

  // Worker for resume tailoring + PDF generation (localConcurrency 2 – Chromium is heavy)
  await boss.work(
    "tailor-job",
    { localConcurrency: 2, batchSize: 1 },
    async (jobs: Job<TailorJobData>[]) => {
      for (const job of jobs) {
        const { userId, jobId, matchId } = job.data;
        console.log(`Running tailor-job for user ${userId} / job ${jobId}...`);
        try {
          await runTailorJob({ userId, jobId, matchId });
        } catch (err) {
          console.error(`Error in tailor-job for user ${userId} / job ${jobId}:`, err);
          throw err;
        }
      }
    }
  );

  // Worker for check-queued-applications
  await boss.work("check-queued-applications", async () => {
    await checkQueuedApplications(boss);
  });

  // Worker for apply job (localConcurrency 2 - Playwright browser automation)
  await boss.work(
    "apply",
    { localConcurrency: 2, batchSize: 1 },
    async (jobs: Job<ApplyJobData>[]) => {
      for (const job of jobs) {
        const { applicationId } = job.data;
        console.log(`Running apply job for application ${applicationId}...`);
        try {
          await runApplyJob(job.data);
          console.log(`Apply job completed for application ${applicationId}.`);
        } catch (err) {
          console.error(`Error in apply job for application ${applicationId}:`, err);
          throw err;
        }
      }
    }
  );

  // Graceful shutdown handlers
  const shutdown = async () => {
    console.log("Stopping worker gracefully...");
    clearInterval(queuedAppsInterval);
    await boss.stop({ graceful: true });
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
