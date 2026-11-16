import process from "node:process";
import { PgBoss, type Job } from "pg-boss";
import { getServiceClient } from "./utils/supabase.js";
import { syncCompany } from "./sync/sync-company.js";

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

async function main() {
  console.log("Starting Qlam worker...");
  const boss = new PgBoss({
    connectionString,
    max: 10,
  });

  boss.on("error", (error) => console.error("pg-boss error:", error));

  await boss.start();
  console.log("pg-boss started successfully.");

  for (const queue of ["sync-jobs", "check-requested-syncs", "sync-company"]) {
    await boss.createQueue(queue);
  }

  // Schedule recurring sync every 6 hours
  await boss.schedule("sync-jobs", "0 */6 * * *");
  console.log("Registered cron schedule: sync-jobs (every 6 hours)");

  // Schedule on-demand check every minute
  await boss.schedule("check-requested-syncs", "* * * * *");

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

  // Graceful shutdown handlers
  const shutdown = async () => {
    console.log("Stopping worker gracefully...");
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

