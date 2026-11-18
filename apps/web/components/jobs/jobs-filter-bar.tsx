"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Loader2,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Calendar,
} from "lucide-react";

export type PostedWithinOption = "all" | "7d" | "30d";

interface JobsFilterBarProps {
  isMatching: boolean;
  onFindMatches: () => void;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (remote: boolean) => void;
  postedWithin: PostedWithinOption;
  onPostedWithinChange: (val: PostedWithinOption) => void;
  sortOrder: "desc" | "asc";
  onSortOrderChange: (order: "desc" | "asc") => void;
  totalMatches: number;
  filteredCount: number;
}

export function JobsFilterBar({
  isMatching,
  onFindMatches,
  minScore,
  onMinScoreChange,
  remoteOnly,
  onRemoteOnlyChange,
  postedWithin,
  onPostedWithinChange,
  sortOrder,
  onSortOrderChange,
  totalMatches,
  filteredCount,
}: JobsFilterBarProps) {
  const SCORE_PRESETS = [0, 60, 70, 80];
  const POSTED_PRESETS: { label: string; value: PostedWithinOption }[] = [
    { label: "All", value: "all" },
    { label: "7 days", value: "7d" },
    { label: "30 days", value: "30d" },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Feed Filters & Matching
          </h2>
          <p className="text-xs text-muted-foreground">
            Showing {filteredCount} of {totalMatches} matched {totalMatches === 1 ? "job" : "jobs"}
          </p>
        </div>

        <Button
          onClick={onFindMatches}
          disabled={isMatching}
          size="sm"
          className="h-9 px-4 text-xs font-medium gap-2 shadow-sm"
        >
          {isMatching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
              <span>Matching & Scoring...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-primary-foreground" />
              <span>Find my matches</span>
            </>
          )}
        </Button>
      </div>

      {/* Filter and Sort controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border/60">
        {/* Min Score Filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-xs font-medium text-foreground">Min Match Score</Label>
            <span className="font-semibold text-primary">{minScore}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            {SCORE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={minScore === preset ? "default" : "outline"}
                size="sm"
                onClick={() => onMinScoreChange(preset)}
                className="h-7 text-[11px] px-2 flex-1"
              >
                {preset === 0 ? "All" : `${preset}+`}
              </Button>
            ))}
          </div>
        </div>

        {/* Posted Within Filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" /> Posted Within
            </Label>
            <span className="text-[11px] text-muted-foreground font-medium">
              {postedWithin === "all" ? "Any time" : `< ${postedWithin}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {POSTED_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={postedWithin === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => onPostedWithinChange(preset.value)}
                className="h-7 text-[11px] px-2 flex-1"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Remote Only Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 bg-muted/20">
          <div className="space-y-0.5">
            <Label htmlFor="feed-remote-toggle" className="text-xs font-medium cursor-pointer">
              Remote Roles Only
            </Label>
            <p className="text-[10px] text-muted-foreground">Hide in-person positions</p>
          </div>
          <Switch
            id="feed-remote-toggle"
            checked={remoteOnly}
            onCheckedChange={onRemoteOnlyChange}
            className="ml-3"
          />
        </div>

        {/* Sort by Score Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 bg-muted/20">
          <div className="text-xs text-muted-foreground">
            <Label className="text-xs font-medium text-foreground">Sort Order</Label>
            <p className="text-[10px] text-muted-foreground">
              {sortOrder === "desc" ? "Highest score first" : "Lowest score first"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSortOrderChange(sortOrder === "desc" ? "asc" : "desc")}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            {sortOrder === "desc" ? (
              <span className="flex items-center gap-0.5 font-medium">
                High <ArrowDown className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5 font-medium">
                Low <ArrowUp className="h-3 w-3" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
