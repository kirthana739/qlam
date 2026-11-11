import { redirect } from "next/navigation";
import { requireAdminUser, getAdminServiceClient } from "@/lib/admin";
import { CompanyListClient, type CompanyRowData } from "./company-list-client";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  // 1. Server-side ADMIN_EMAILS check
  try {
    await requireAdminUser();
  } catch (err) {
    console.warn("Admin access denied:", err instanceof Error ? err.message : err);
    redirect("/app/jobs");
  }

  // 2. Fetch companies using service client
  const supabase = getAdminServiceClient();

  const { data: companiesRaw, error: companiesError } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  if (companiesError) {
    throw new Error(`Failed to load companies: ${companiesError.message}`);
  }

  // 3. Query jobs summary counts
  const { data: jobsSummary } = await supabase
    .from("jobs")
    .select("company_id, is_open");

  const countsMap = new Map<string, { total: number; open: number }>();
  for (const job of jobsSummary || []) {
    const current = countsMap.get(job.company_id) || { total: 0, open: 0 };
    current.total += 1;
    if (job.is_open) current.open += 1;
    countsMap.set(job.company_id, current);
  }

  const companies: CompanyRowData[] = (companiesRaw || []).map((c) => {
    const stats = countsMap.get(c.id) || { total: 0, open: 0 };
    return {
      id: c.id,
      name: c.name,
      ats: c.ats as "greenhouse" | "lever" | "ashby",
      board_token: c.board_token,
      active: c.active,
      last_synced_at: c.last_synced_at,
      sync_requested_at: c.sync_requested_at,
      totalJobs: stats.total,
      openJobs: stats.open,
    };
  });

  return (
    <div className="space-y-6">
      <CompanyListClient companies={companies} />
    </div>
  );
}
