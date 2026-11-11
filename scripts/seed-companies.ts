import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { type Database, type AtsType } from "@qlam/core";

// Load environment variables from worker or web env files if present
for (const envPath of ["apps/worker/.env", "apps/web/.env.local", ".env"]) {
  try {
    if (fs.existsSync(envPath)) {
      process.loadEnvFile?.(envPath);
    }
  } catch {
    // Ignore load errors
  }
}

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables."
  );
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  const csvPath = path.resolve(process.cwd(), "supabase/seed/companies.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`Seed file not found at ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    console.log("No company records found in seed file.");
    return;
  }

  // Parse header
  const header = lines[0]?.toLowerCase().split(",").map((h) => h.trim()) || [];
  const nameIdx = header.indexOf("name");
  const atsIdx = header.indexOf("ats");
  const tokenIdx = header.indexOf("token");

  if (nameIdx === -1 || atsIdx === -1 || tokenIdx === -1) {
    console.error(
      "CSV must have 'name,ats,token' columns in the header."
    );
    process.exit(1);
  }

  const companiesToUpsert: Array<{
    name: string;
    ats: AtsType;
    board_token: string;
    active: boolean;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]?.split(",").map((val) => val.trim());
    if (!row || row.length < 3) continue;

    const name = row[nameIdx] || "";
    const ats = (row[atsIdx] || "").toLowerCase() as AtsType;
    const token = row[tokenIdx] || "";

    if (!name || !token) continue;
    if (!["greenhouse", "lever", "ashby"].includes(ats)) {
      console.warn(`Skipping row ${i}: invalid ATS "${ats}"`);
      continue;
    }

    companiesToUpsert.push({
      name,
      ats,
      board_token: token,
      active: true,
    });
  }

  console.log(`Seeding ${companiesToUpsert.length} companies...`);

  const { data, error } = await supabase
    .from("companies")
    .upsert(companiesToUpsert, {
      onConflict: "ats, board_token",
    })
    .select("id, name, ats, board_token");

  if (error) {
    console.error("Failed to upsert companies:", error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data?.length || 0} companies.`);
}

seed().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
