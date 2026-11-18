"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResumeDiffCard } from "./resume-diff-card";
import { EditResumeDialog } from "./edit-dialog";
import { approveResume, restoreOriginalResume, updateTailoredResume } from "./actions";
import { truthCheck, type ResumeData } from "@qlam/core";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Check,
  RotateCcw,
  Edit3,
  Copy,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface ReviewClientProps {
  tailoredId: string;
  baseResume: ResumeData;
  tailoredResume: ResumeData;
  initialApproved: boolean;
  initialTruthCheckOk: boolean;
  tailoringStrength: string;
  coverLetter: string | null;
  pdfPath: string | null;
  jobTitle: string;
  companyName: string;
}

export function ReviewClient({
  tailoredId,
  baseResume,
  tailoredResume: initialTailored,
  initialApproved,
  initialTruthCheckOk,
  tailoringStrength,
  coverLetter,
  jobTitle,
  companyName,
}: ReviewClientProps) {
  const [tailored, setTailored] = useState<ResumeData>(initialTailored);
  const [approved, setApproved] = useState(initialApproved);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Run truthCheck dynamically
  const dynamicTruth = truthCheck(baseResume, tailored);
  const truthOk = initialTruthCheckOk && dynamicTruth.ok;

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveResume(tailoredId);
      if (res.error) {
        toast.error(`Failed to approve: ${res.error}`);
      } else {
        setApproved(true);
        toast.success("Resume approved for submission!");
      }
    });
  };

  const handleUseOriginal = () => {
    startTransition(async () => {
      const res = await restoreOriginalResume(tailoredId);
      if (res.error) {
        toast.error(`Failed to restore base resume: ${res.error}`);
      } else {
        setTailored(baseResume);
        setApproved(true);
        toast.success("Original base resume restored and approved!");
      }
    });
  };

  const handleSaveEdit = async (updated: ResumeData) => {
    const res = await updateTailoredResume(tailoredId, updated);
    if (res.error) {
      toast.error(`Failed to update resume: ${res.error}`);
    } else {
      setTailored(updated);
      toast.success("Tailored resume updated successfully.");
    }
  };

  const handleCopyCoverLetter = () => {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    toast.success("Cover letter copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/app/jobs"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs Feed
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Review Tailored Application
          </h1>
          <p className="text-xs text-muted-foreground">
            Target Role: <span className="font-semibold text-foreground">{jobTitle}</span> at{" "}
            <span className="font-semibold text-foreground">{companyName}</span> • Tailoring Mode:{" "}
            <Badge variant="outline" className="capitalize text-[11px] ml-1">
              {tailoringStrength}
            </Badge>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {approved && (
            <Badge variant="default" className="bg-emerald-600 text-white text-xs py-1 px-2.5 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Approved
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleUseOriginal}
            disabled={isPending}
            className="text-xs h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Use Original
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            disabled={isPending}
            className="text-xs h-8"
          >
            <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleApprove}
            disabled={isPending || approved}
            className="text-xs h-8 min-w-[100px]"
          >
            <Check className="h-3.5 w-3.5 mr-1" /> {approved ? "Approved" : "Approve"}
          </Button>
        </div>
      </div>

      {/* Truth-Check Banner */}
      {truthOk ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Truth Check Passed (0 Violations)
            </h4>
            <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300/90">
              Strict fact-checking verified: all employers, job titles, employment dates, academic
              institutions, degrees, metrics, and skills match or are subsets of your verified base resume.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Truth Check Alert: Potential Discrepancies Flagged
            </h4>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
              Automated checking identified modified items that did not match base resume facts:
            </p>
            <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-900 dark:text-amber-200">
              {dynamicTruth.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Cover Letter Section (if present) */}
      {coverLetter && (
        <Card className="border-border">
          <CardHeader className="py-3 px-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Targeted Cover Letter (≤ 150 Words)
              </CardTitle>
              <CardDescription className="text-xs">
                Generated strictly referencing your verified achievements.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCoverLetter}
              className="h-7 text-xs"
            >
              {copied ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/50">
              {coverLetter}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ResumeDiffCard
          title="Base Resume"
          subtitle="Your unedited, verified profile facts"
          resume={baseResume}
          counterpartResume={tailored}
        />
        <ResumeDiffCard
          title="Tailored Resume"
          subtitle={`Adapted for ${jobTitle} (${tailoringStrength} mode)`}
          resume={tailored}
          isTailored={true}
          counterpartResume={baseResume}
        />
      </div>

      {/* Edit Modal */}
      <EditResumeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        resume={tailored}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
