"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileCheck,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app-shell/empty-state";
import { createClient } from "@/lib/supabase/client";
import { NeedsUserBanner, type ApplicationNeedingUser } from "./needs-user-banner";

interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id: string;
  run_status: string;
  dry_run: boolean;
  needs_user_reason: string | null;
  error: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  screenshot_paths: string[];
  job: {
    id: string;
    title: string;
    location: string | null;
    apply_url: string;
    company: {
      name: string;
    } | null;
  } | null;
}

export function ApplicationsListClient() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadApplications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          user_id,
          job_id,
          run_status,
          dry_run,
          needs_user_reason,
          error,
          submitted_at,
          created_at,
          updated_at,
          screenshot_paths,
          job:jobs(
            id,
            title,
            location,
            apply_url,
            company:companies(name)
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      setApplications((data as unknown as ApplicationRecord[]) || []);
    } catch (err) {
      console.error("[Applications] Failed to load applications:", err);
      toast.error("Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Polling for live status while an application is queued or running
  useEffect(() => {
    const hasActive = applications.some(
      (a) => a.run_status === "queued" || a.run_status === "running"
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      loadApplications();
    }, 4000);

    return () => clearInterval(interval);
  }, [applications, loadApplications]);

  const needsUserApps: ApplicationNeedingUser[] = applications
    .filter((a) => a.run_status === "needs_user")
    .map((a) => ({
      id: a.id,
      job_id: a.job_id,
      run_status: a.run_status,
      needs_user_reason: a.needs_user_reason,
      job: a.job
        ? {
            title: a.job.title,
            company: a.job.company ? { name: a.job.company.name } : undefined,
          }
        : null,
    }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Needs User Banner */}
      {needsUserApps.length > 0 && (
        <NeedsUserBanner
          applications={needsUserApps}
          onApplicationUpdated={loadApplications}
        />
      )}

      {/* 2. Applications Feed */}
      {applications.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No applications yet"
          description="Find matching positions on the Jobs feed and click Apply to queue applications."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {applications.length} application{applications.length === 1 ? "" : "s"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadApplications}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </Button>
          </div>

          {applications.map((app) => {
            const companyName = app.job?.company?.name || "Company";
            const jobTitle = app.job?.title || "Position";

            return (
              <Card key={app.id} className="border-border/60 hover:border-border transition-colors">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                        {jobTitle}
                      </h3>
                      {app.run_status === "submitted" && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{app.dry_run ? "Proof Ready (Dry)" : "Submitted"}</span>
                        </Badge>
                      )}
                      {app.run_status === "running" && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] gap-1 text-primary border-primary/20 animate-pulse font-medium"
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Applying...</span>
                        </Badge>
                      )}
                      {app.run_status === "queued" && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground font-medium"
                        >
                          <Clock className="h-3 w-3" />
                          <span>Queued</span>
                        </Badge>
                      )}
                      {app.run_status === "needs_user" && (
                        <Badge
                          variant="destructive"
                          className="h-5 px-1.5 text-[10px] gap-1 font-medium"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>Action Needed</span>
                        </Badge>
                      )}
                      {app.run_status === "failed" && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] gap-1 border-destructive/40 text-destructive font-medium"
                        >
                          <span>Failed</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {companyName}
                      </span>
                      {app.job?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {app.job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(app.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {app.job?.apply_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 text-xs gap-1.5 font-medium"
                      >
                        <a
                          href={app.job.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>Listing</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
