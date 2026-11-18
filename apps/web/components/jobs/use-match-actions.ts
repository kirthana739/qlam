import { useState } from "react";
import { toast } from "sonner";
import type { JobMatchItem } from "./job-card";

interface UseMatchActionsProps {
  setMatches: React.Dispatch<React.SetStateAction<JobMatchItem[]>>;
}

export function useMatchActions({ setMatches }: UseMatchActionsProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);

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
      toast.error(err instanceof Error ? err.message : "Failed to save job.");
    } finally {
      setSavingId(null);
    }
  };

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

      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      toast.success("Job skipped.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to skip job.");
    } finally {
      setSkippingId(null);
    }
  };

  return {
    savingId,
    skippingId,
    handleSaveMatch,
    handleSkipMatch,
  };
}
