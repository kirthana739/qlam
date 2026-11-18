import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@qlam/core";

/**
 * Downloads the tailored resume PDF from Supabase Storage and
 * writes it to a temporary file on disk for Playwright upload.
 */
export async function downloadTailoredPdf(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobId: string,
  tailoredResumeId?: string | null
): Promise<string | null> {
  let pdfPath = "";

  if (tailoredResumeId) {
    const { data: tr } = await supabase
      .from("tailored_resumes")
      .select("pdf_path")
      .eq("id", tailoredResumeId)
      .single();
    pdfPath = tr?.pdf_path || "";
  }

  if (!pdfPath) {
    const { data: tr } = await supabase
      .from("tailored_resumes")
      .select("pdf_path")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    pdfPath = tr?.pdf_path || "";
  }

  if (!pdfPath) {
    return null;
  }

  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(pdfPath);

  if (downloadError || !pdfBlob) {
    return null;
  }

  const buffer = Buffer.from(await pdfBlob.arrayBuffer());
  const tempPdfPath = path.join(os.tmpdir(), `qlam-resume-${Date.now()}.pdf`);
  fs.writeFileSync(tempPdfPath, buffer);
  return tempPdfPath;
}
