"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, FilterX, Sparkles, Loader2 } from "lucide-react";

interface ProfileIncompleteNoticeProps {
  isMatching: boolean;
  onFindMatches: () => void;
}

export function ProfileIncompleteNotice({
  isMatching,
  onFindMatches,
}: ProfileIncompleteNoticeProps) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-foreground">
              Complete your profile for better matches
            </h4>
            <p className="text-xs text-muted-foreground">
              Add your target roles, salary, or upload a resume to unlock high-accuracy AI matching.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline" className="text-xs h-8">
            <Link href="/app/onboarding">Edit Preferences</Link>
          </Button>
          <Button
            size="sm"
            onClick={onFindMatches}
            disabled={isMatching}
            className="text-xs h-8 gap-1.5"
          >
            {isMatching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Find Matches Now</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface NoMatchesFoundProps {
  onResetFilters: () => void;
}

export function NoMatchesFound({ onResetFilters }: NoMatchesFoundProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3 bg-muted/10">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FilterX className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">No jobs match your filters</h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Try lowering the minimum match score or clearing the remote/date filters.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onResetFilters} className="text-xs h-8">
        Reset Filters
      </Button>
    </div>
  );
}
