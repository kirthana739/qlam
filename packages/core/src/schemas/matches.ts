import { z } from "zod";

export const MatchReasonsSchema = z.object({
  summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  skills_overlap: z.array(z.string()).optional(),
  score_breakdown: z
    .object({
      skills: z.number().min(0).max(100).optional(),
      experience: z.number().min(0).max(100).optional(),
      role_fit: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export type MatchReasons = z.infer<typeof MatchReasonsSchema>;
