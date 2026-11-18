import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewClient } from "./review-client";
import type { ResumeData } from "@qlam/core";

export const metadata = {
  title: "Review Tailored Resume | Qlam",
  description: "Review and approve your AI-tailored resume before application submission.",
};

interface ReviewPageProps {
  params: Promise<{ tailoredId: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { tailoredId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch tailored resume (RLS ensures user owns this row)
  const { data: tailoredRow, error: tailoredError } = await supabase
    .from("tailored_resumes")
    .select(`
      id,
      user_id,
      job_id,
      base_resume_id,
      content,
      pdf_path,
      approved,
      cover_letter,
      truth_check_ok,
      tailoring_strength,
      created_at,
      jobs (
        id,
        title,
        location,
        is_remote,
        company_id,
        companies (
          name
        )
      )
    `)
    .eq("id", tailoredId)
    .single();

  if (tailoredError || !tailoredRow) {
    notFound();
  }

  // 2. Fetch the corresponding base resume (RLS ensures user owns this row)
  const { data: baseRow } = await supabase
    .from("resumes")
    .select("id, parsed")
    .eq("id", tailoredRow.base_resume_id)
    .single();

  const baseResume = (baseRow?.parsed as unknown as ResumeData) || null;
  const tailoredResume = (tailoredRow.content as unknown as ResumeData) || null;

  if (!baseResume || !tailoredResume) {
    notFound();
  }

  // Extract job details safely
  const job = Array.isArray(tailoredRow.jobs)
    ? tailoredRow.jobs[0]
    : tailoredRow.jobs;
  const company = job?.companies
    ? Array.isArray(job.companies)
      ? job.companies[0]
      : job.companies
    : null;

  const jobTitle = job?.title || "Target Role";
  const companyName = company?.name || "Target Company";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ReviewClient
        tailoredId={tailoredRow.id}
        baseResume={baseResume}
        tailoredResume={tailoredResume}
        initialApproved={tailoredRow.approved}
        initialTruthCheckOk={tailoredRow.truth_check_ok}
        tailoringStrength={tailoredRow.tailoring_strength || "medium"}
        coverLetter={tailoredRow.cover_letter || null}
        pdfPath={tailoredRow.pdf_path || null}
        jobTitle={jobTitle}
        companyName={companyName}
      />
    </div>
  );
}
