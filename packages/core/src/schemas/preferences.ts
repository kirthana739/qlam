import { z } from "zod";

export const PreferencesSchema = z.object({
  roles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remote: z.boolean().default(false),
  seniority: z.array(z.string()).default([]),
  excluded_companies: z.array(z.string()).default([]),
});

export type Preferences = z.infer<typeof PreferencesSchema>;
