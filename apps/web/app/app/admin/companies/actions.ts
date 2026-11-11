"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser, getAdminServiceClient } from "@/lib/admin";
import { type AtsType } from "@qlam/core";

export const AddCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  ats: z.enum(["greenhouse", "lever", "ashby"], {
    message: "ATS must be one of: greenhouse, lever, ashby",
  }),
  token: z
    .string()
    .trim()
    .min(1, "Board token / slug is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Token must match /^[a-zA-Z0-9_-]+$/"),
});

export type AddCompanyInput = z.infer<typeof AddCompanySchema>;

export async function addCompanyAction(input: AddCompanyInput) {
  // 1. Server-side admin verification
  await requireAdminUser();

  // 2. Strict Zod validation
  const validation = AddCompanySchema.safeParse(input);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join(", ");
    return { error: errorMsg };
  }

  const { name, ats, token } = validation.data;

  // 3. Service role client used only on server after check
  const supabase = getAdminServiceClient();

  const { error } = await supabase.from("companies").upsert(
    {
      name,
      ats: ats as AtsType,
      board_token: token,
      active: true,
      sync_requested_at: new Date().toISOString(),
    },
    { onConflict: "ats, board_token" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/admin/companies");
  return { success: true };
}

export async function requestSyncAction(companyId: string) {
  // 1. Server-side admin verification
  await requireAdminUser();

  if (!companyId || typeof companyId !== "string") {
    return { error: "Invalid company ID" };
  }

  // 2. Service role client sets sync_requested_at = now()
  const supabase = getAdminServiceClient();
  const nowISO = new Date().toISOString();

  const { error } = await supabase
    .from("companies")
    .update({ sync_requested_at: nowISO })
    .eq("id", companyId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/admin/companies");
  return { success: true };
}
