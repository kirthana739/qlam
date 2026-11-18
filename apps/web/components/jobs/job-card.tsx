"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  Loader2,
} from "lucide-react";
import { SkipReasonDialog } from "./skip-reason-dialog";

export interface JobMatchItem {
  id: string;
  job_id: string;
  score: number;
  status: string;
  reasons: {
    fits?: string[];
    gaps?: string[];
    dealbreakers?: string[];
    skip_reason?: string;
  };
  created_at: string;
  jobs: {
    id: string;
    title: string;
    location: string | null;
    is_remote: boolean;
    apply_url: string;
    description_text: string | null;
    posted_at: string | null;
    companies: {
      name: string;
    } | null;
  } | null;
}

interface JobCardProps {
  match: JobMatchItem;
  onSave?: (matchId: string) => Promise<void> | void;
  onSkip?: (matchId: string, reason?: string) => Promise<void> | void;
  isSaving?: boolean;
  isSkipping?: boolean;
}

export function JobCard({
  match,
  onSave,
  onSkip,
  isSaving = false,
  isSkipping = false,
}: JobCardProps) {
  const [showGaps, setShowGaps] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);

  const job = match.jobs;
  const companyName = job?.companies?.name || "Company";
  const title = job?.title || "Job Listing";
  const location = job?.location || "Not specified";
  const isRemote = job?.is_remote ?? false;
  const applyUrl = job?.apply_url || "#";
  const postedAt = job?.posted_at;

  const fits = match.reasons?.fits || [];
  const gaps = match.reasons?.gaps || [];
  const dealbreakers = match.reasons?.dealbreakers || [];

  const firstFit = fits[0] || "Profile matches key role requirements.";
  const hasGaps = gaps.length > 0 || dealbreakers.length > 0;
  const isSaved = match.status === "saved";

  // Score badge color calculation: 80+ green, 60-79 amber, below 60 grey
  const getScoreBadgeStyles = (score: number) => {
    if (score >= 80) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold";
    }
    if (score >= 60) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold";
    }
    return "bg-muted text-muted-foreground border-border font-semibold";
  };

  const handleSkipConfirm = async (reason?: string) => {
    if (onSkip) {
      await onSkip(match.id, reason);
    }
    setSkipDialogOpen(false);
  };

  const formatPostedDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Posted today";
    if (diffDays === 1) return "Posted yesterday";
    return `Posted ${diffDays}d ago`;
  };

  return (
    <>
      <Card className="overflow-hidden border border-border/80 transition-shadow hover:shadow-md">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header row: Title, Company, Badges */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base sm:text-lg text-foreground tracking-tight truncate">
                  {title}
                </h3>
                {isRemote && (
                  <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                    Remote
                  </Badge>
                )}
                {isSaved && (
                  <Badge variant="secondary" className="text-[11px] font-medium gap-1 bg-primary/10 text-primary">
                    <BookmarkCheck className="h-3 w-3" /> Saved
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground/80">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {companyName}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {location}
                </span>
                {postedAt && (
                  <span className="text-[11px] text-muted-foreground/80">
                    • {formatPostedDate(postedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Score Badge */}
            <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
              <Badge
                variant="outline"
                className={`text-sm px-2.5 py-1 flex items-center gap-1 ${getScoreBadgeStyles(match.score)}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{match.score}% Match</span>
              </Badge>
            </div>
          </div>

          {/* First Fit: One-line reason */}
          <div className="rounded-lg bg-muted/40 p-3 border border-border/60">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-foreground/90 font-medium line-clamp-2">
                {firstFit}
              </p>
            </div>
          </div>

          {/* Expandable Gaps Section */}
          {hasGaps && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowGaps(!showGaps)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {showGaps ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Hide considerations & gaps
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    View considerations ({gaps.length + dealbreakers.length})
                  </>
                )}
              </button>

              {showGaps && (
                <div className="space-y-2 pt-1">
                  {dealbreakers.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Dealbreakers
                      </span>
                      <ul className="list-disc list-inside text-xs text-destructive space-y-0.5 pl-1">
                        {dealbreakers.map((db, idx) => (
                          <li key={idx}>{db}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gaps.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Potential Gaps
                      </span>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5 pl-1">
                        {gaps.map((gap, idx) => (
                          <li key={idx}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Card Footer: Metadata and Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground">
              Matched {new Date(match.created_at).toLocaleDateString()}
            </span>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* Skip Button */}
              {onSkip && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSkipDialogOpen(true)}
                  disabled={isSkipping}
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-destructive"
                >
                  {isSkipping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  <span>Skip</span>
                </Button>
              )}

              {/* Save Button */}
              {onSave && (
                <Button
                  type="button"
                  variant={isSaved ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onSave(match.id)}
                  disabled={isSaving}
                  className={`h-8 text-xs gap-1.5 ${isSaved ? "text-primary font-medium" : ""}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSaved ? (
                    <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </Button>
              )}

              {/* View Job Link */}
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                  <span>View Job</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skip confirmation modal with optional presets */}
      <SkipReasonDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        jobTitle={title}
        companyName={companyName}
        isSubmitting={isSkipping}
        onConfirmSkip={handleSkipConfirm}
      />
    </>
  );
}
