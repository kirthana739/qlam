"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Clock, AlertTriangle, Send } from "lucide-react";

export interface ApplicationStatusInfo {
  id: string;
  run_status: string;
  dry_run?: boolean;
  needs_user_reason?: string | null;
  error?: string | null;
}

interface ApplyStatusBadgeProps {
  application?: ApplicationStatusInfo | null;
  matchStatus: string;
  isApplying?: boolean;
  onApply?: () => void;
}

export function ApplyStatusBadge({
  application,
  matchStatus,
  isApplying = false,
  onApply,
}: ApplyStatusBadgeProps) {
  const status =
    application?.run_status ||
    (matchStatus === "queued"
      ? "queued"
      : matchStatus === "applied"
      ? "submitted"
      : null);

  if (status === "submitted" || matchStatus === "applied") {
    return (
      <Badge
        variant="outline"
        className="h-8 px-2.5 text-xs font-medium gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>{application?.dry_run ? "Proof Ready (Dry)" : "Applied"}</span>
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge
        variant="secondary"
        className="h-8 px-2.5 text-xs font-medium gap-1.5 text-primary border-primary/20 animate-pulse"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Applying...</span>
      </Badge>
    );
  }

  if (status === "queued") {
    return (
      <Badge
        variant="secondary"
        className="h-8 px-2.5 text-xs font-medium gap-1.5 text-muted-foreground border-border"
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Queued...</span>
      </Badge>
    );
  }

  if (status === "needs_user") {
    return (
      <Badge
        variant="destructive"
        className="h-8 px-2.5 text-xs font-medium gap-1.5"
        title={application?.needs_user_reason || undefined}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Action Needed</span>
      </Badge>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={onApply}
      disabled={isApplying}
      className="h-8 text-xs gap-1.5 font-medium shadow-sm"
    >
      {isApplying ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      <span>{status === "failed" ? "Retry Apply" : "Apply"}</span>
    </Button>
  );
}
