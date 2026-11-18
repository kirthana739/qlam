"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ResumeDataSchema, type ResumeData, type Json } from "@qlam/core";

/**
 * Approve a tailored resume: sets approved = true.
 * Uses the session client so RLS enforces user ownership.
 */
export async function approveResume(tailoredId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("tailored_resumes")
    .update({ approved: true })
    .eq("id", tailoredId)
    .eq("user_id", user.id); // redundant with RLS, but explicit

  if (error) return { error: error.message };
  revalidatePath(`/app/review/${tailoredId}`);
  return {};
}

/**
 * Restore original: replaces the tailored content with the base resume content
 * and marks approved = true so the apply flow can proceed.
 */
export async function restoreOriginalResume(tailoredId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Fetch the tailored_resumes row to get base_resume_id
  const { data: row, error: fetchError } = await supabase
    .from("tailored_resumes")
    .select("base_resume_id")
    .eq("id", tailoredId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row) return { error: fetchError?.message ?? "Not found" };

  // Fetch the base resume content
  const { data: base, error: baseError } = await supabase
    .from("resumes")
    .select("parsed")
    .eq("id", row.base_resume_id)
    .eq("user_id", user.id)
    .single();

  if (baseError || !base) return { error: baseError?.message ?? "Base resume not found" };

  // Overwrite content with base, mark approved, clear pdf_path so it is re-generated if needed
  const { error: updateError } = await supabase
    .from("tailored_resumes")
    .update({
      content: base.parsed,
      approved: true,
      truth_check_ok: true,
      pdf_path: null,
    })
    .eq("id", tailoredId)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };
  revalidatePath(`/app/review/${tailoredId}`);
  return {};
}

/**
 * Edit and save updated tailored resume content.
 */
export async function updateTailoredResume(
  tailoredId: string,
  content: ResumeData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = ResumeDataSchema.safeParse(content);
  if (!parsed.success) {
    return { error: "Invalid resume format: " + parsed.error.issues[0]?.message };
  }

  const { error } = await supabase
    .from("tailored_resumes")
    .update({
      content: parsed.data as unknown as Json,
      pdf_path: null,
    })
    .eq("id", tailoredId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/app/review/${tailoredId}`);
  return {};
}

