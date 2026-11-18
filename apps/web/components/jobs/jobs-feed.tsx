"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobCard, type JobMatchItem } from "./job-card";
import { type ApplicationStatusInfo } from "./apply-status-badge";
import { JobsFilterBar, type PostedWithinOption } from "./jobs-filter-bar";
import { ProfileIncompleteNotice, NoMatchesFound } from "./jobs-feed-empty-states";
import { useFilteredMatches } from "./use-job-filters";
import { useMatchActions } from "./use-match-actions";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function JobsFeed() {
  const supabase = createClient();

  const [matches, setMatches] = useState<JobMatchItem[]>([]);
  const [appsByJobId, setAppsByJobId] = useState<Record<string, ApplicationStatusInfo>>({});
  const [loading, setLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [minScore, setMinScore] = useState<number>(0);
  const [remoteOnly, setRemoteOnly] = useState<boolean>(false);
  const [postedWithin, setPostedWithin] = useState<PostedWithinOption>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const { savingId, skippingId, handleSaveMatch, handleSkipMatch } = useMatchActions({
    setMatches,
  });

  // 1. Fetch matches from Supabase
  const loadMatches = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Check profile status
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences, onboarding_done")
        .eq("user_id", user.id)
        .maybeSingle();

      const prefs = profile?.preferences as { roles?: string[] } | null;
      if (!profile?.onboarding_done && (!prefs?.roles || prefs.roles.length === 0)) {
        setProfileIncomplete(true);
      } else {
        setProfileIncomplete(false);
      }

      const { data, error } = await supabase
        .from("matches")
        .select(`
          id,
          job_id,
          score,
          status,
          reasons,
          created_at,
          jobs (
            id,
            title,
            location,
            is_remote,
            apply_url,
            description_text,
            posted_at,
            companies (
              name
            )
          )
        `)
        .eq("user_id", user.id)
        .neq("status", "skipped")
        .order("score", { ascending: false });

      if (error) {
        console.error("Error fetching matches:", error);
        toast.error("Failed to load matched jobs.");
        return;
      }

      setMatches((data as unknown as JobMatchItem[]) || []);

      // Fetch applications
      const { data: appsData } = await supabase
        .from("applications")
        .select("id, job_id, run_status, dry_run, needs_user_reason, error")
        .eq("user_id", user.id);

      if (appsData) {
        const appMap: Record<string, ApplicationStatusInfo> = {};
        for (const app of appsData) {
          appMap[app.job_id] = app as ApplicationStatusInfo;
        }
        setAppsByJobId(appMap);
      }
    } catch (err) {
      console.error("Failed to load matches:", err);
      toast.error("Unexpected error loading matches.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Polling for live status while an application is queued or running
  useEffect(() => {
    const hasActiveApp = Object.values(appsByJobId).some(
      (a) => a.run_status === "queued" || a.run_status === "running"
    );
    if (!hasActiveApp) return;

    const interval = setInterval(() => {
      loadMatches();
    }, 3000);

    return () => clearInterval(interval);
  }, [appsByJobId, loadMatches]);

  // 2. Trigger /api/match to run profile embedding and scoring
  const handleFindMatches = async () => {
    setIsMatching(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate matches.");
      }

      if (data.scoredCount > 0) {
        toast.success(
          `Found and scored ${data.scoredCount} new ${
            data.scoredCount === 1 ? "match" : "matches"
          }!`
        );
      } else if (data.message) {
        toast.info(data.message);
      } else {
        toast.info("No new matching jobs found right now.");
      }

      // Reload matches list
      await loadMatches();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error finding matches.";
      toast.error(message);
    } finally {
      setIsMatching(false);
    }
  };

  // Apply action
  const handleApply = async (jobId: string, matchId: string) => {
    setApplyingJobId(jobId);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, matchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to enqueue application.");
      }
      toast.success("Application enqueued! AI agent is tailoring resume and applying...");
      await loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error applying.");
    } finally {
      setApplyingJobId(null);
    }
  };

  // 5. Filter and sort matches
  const filteredAndSortedMatches = useFilteredMatches({
    matches,
    minScore,
    remoteOnly,
    postedWithin,
    sortOrder,
  });

  if (loading) {
    return (
      <div className="min-h-[45vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Loading your matched jobs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optional banner if profile needs completion */}
      {profileIncomplete && (
        <ProfileIncompleteNotice
          isMatching={isMatching}
          onFindMatches={handleFindMatches}
        />
      )}

      {/* Filter and matching control bar */}
      <JobsFilterBar
        isMatching={isMatching}
        onFindMatches={handleFindMatches}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        remoteOnly={remoteOnly}
        onRemoteOnlyChange={setRemoteOnly}
        postedWithin={postedWithin}
        onPostedWithinChange={setPostedWithin}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        totalMatches={matches.length}
        filteredCount={filteredAndSortedMatches.length}
      />

      {/* Main feed cards */}
      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-4 bg-muted/10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No matches found yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Click &quot;Find my matches&quot; to scan discovered job listings and calculate personalized fit scores based on your resume.
            </p>
          </div>
          <Button
            onClick={handleFindMatches}
            disabled={isMatching}
            size="sm"
            className="gap-2 text-xs"
          >
            {isMatching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing Jobs...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Find my matches</span>
              </>
            )}
          </Button>
        </div>
      ) : filteredAndSortedMatches.length === 0 ? (
        <NoMatchesFound
          onResetFilters={() => {
            setMinScore(0);
            setRemoteOnly(false);
            setPostedWithin("all");
          }}
        />
      ) : (
        <div className="space-y-3.5">
          {filteredAndSortedMatches.map((item) => (
            <JobCard
              key={item.id}
              match={item}
              application={appsByJobId[item.job_id]}
              onApply={handleApply}
              onSave={handleSaveMatch}
              onSkip={handleSkipMatch}
              isApplying={applyingJobId === item.job_id}
              isSaving={savingId === item.id}
              isSkipping={skippingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
