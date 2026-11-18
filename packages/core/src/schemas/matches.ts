import { z } from "zod";

export const MatchScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  fits: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
});

export type MatchScoreResult = z.infer<typeof MatchScoreResultSchema>;

export const MatchReasonsSchema = z.object({
  fits: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
  summary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  skills_overlap: z.array(z.string()).optional(),
  skip_reason: z.string().optional(),
});

export type MatchReasons = z.infer<typeof MatchReasonsSchema>;

export const UpdateMatchSchema = z.object({
  status: z.enum(["saved", "skipped"]),
  skip_reason: z.string().optional(),
});

export type UpdateMatchInput = z.infer<typeof UpdateMatchSchema>;
