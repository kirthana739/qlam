"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobCard, type JobMatchItem } from "./job-card";
import { JobsFilterBar, type PostedWithinOption } from "./jobs-filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Loader2, Sparkles, FilterX, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function JobsFeed() {
  const supabase = createClient();

  const [matches, setMatches] = useState<JobMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [remoteOnly, setRemoteOnly] = useState<boolean>(false);
  const [postedWithin, setPostedWithin] = useState<PostedWithinOption>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);

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

  // 3. Save match action
  const handleSaveMatch = async (matchId: string) => {
    setSavingId(matchId);
    try {
      const res = await fetch(`/api/match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "saved" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save job.");
      }

      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: "saved" } : m))
      );
      toast.success("Job saved to your shortlist!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save job.";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  // 4. Skip match action
  const handleSkipMatch = async (matchId: string, reason?: string) => {
    setSkippingId(matchId);
    try {
      const res = await fetch(`/api/match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped", skip_reason: reason }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to skip job.");
      }

      // Remove skipped item from current view
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      toast.success("Job skipped.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to skip job.";
      toast.error(message);
    } finally {
      setSkippingId(null);
    }
  };

  // 5. Filter and sort matches
  const filteredAndSortedMatches = useMemo(() => {
    const now = Date.now();
    return matches
      .filter((item) => {
        if (item.score < minScore) return false;
        if (remoteOnly && !item.jobs?.is_remote) return false;

        if (postedWithin !== "all") {
          const postedAtStr = item.jobs?.posted_at;
          if (postedAtStr) {
            const ageDays = (now - new Date(postedAtStr).getTime()) / (1000 * 60 * 60 * 24);
            if (postedWithin === "7d" && ageDays > 7) return false;
            if (postedWithin === "30d" && ageDays > 30) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        return sortOrder === "desc" ? b.score - a.score : a.score - b.score;
      });
  }, [matches, minScore, remoteOnly, postedWithin, sortOrder]);

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
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                To get the most accurate matches, complete your target roles and upload your resume.
              </span>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href="/app/profile">Complete Profile</Link>
            </Button>
          </CardContent>
        </Card>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMinScore(0);
              setRemoteOnly(false);
              setPostedWithin("all");
            }}
            className="text-xs h-8"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAndSortedMatches.map((item) => (
            <JobCard
              key={item.id}
              match={item}
              onSave={handleSaveMatch}
              onSkip={handleSkipMatch}
              isSaving={savingId === item.id}
              isSkipping={skippingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
