import { z } from "zod";

export const SeniorityLevelSchema = z.enum([
  "intern",
  "entry",
  "mid",
  "senior",
]);
export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;

export const PreferencesSchema = z.object({
  roles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remote: z.boolean().default(false),
  seniority: z.array(SeniorityLevelSchema).default([]),
  job_types: z.array(z.string()).default([]),
  companies_to_avoid: z.array(z.string()).default([]),
  excluded_companies: z.array(z.string()).default([]),
  min_match_score: z.number().int().min(0).max(100).default(70),
});

export type Preferences = z.infer<typeof PreferencesSchema>;
