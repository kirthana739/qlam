import { useMemo } from "react";
import type { JobMatchItem } from "./job-card";
import type { PostedWithinOption } from "./jobs-filter-bar";

export interface JobFilterParams {
  matches: JobMatchItem[];
  minScore: number;
  remoteOnly: boolean;
  postedWithin: PostedWithinOption;
  sortOrder: "desc" | "asc";
}

export function useFilteredMatches({
  matches,
  minScore,
  remoteOnly,
  postedWithin,
  sortOrder,
}: JobFilterParams): JobMatchItem[] {
  return useMemo(() => {
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
}
