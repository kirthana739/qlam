import { z } from "zod";

export const ResumeBasicsLocationSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
});
export type ResumeBasicsLocation = z.infer<typeof ResumeBasicsLocationSchema>;

export const ResumeLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
});
export type ResumeLink = z.infer<typeof ResumeLinkSchema>;

export const ResumeBasicsSchema = z.object({
  name: z.string().default(""),
  email: z.string().email().or(z.literal("")).default(""),
  phone: z.string().optional(),
  headline: z.string().optional(),
  location: ResumeBasicsLocationSchema.optional(),
  links: z.array(ResumeLinkSchema).default([]),
});
export type ResumeBasics = z.infer<typeof ResumeBasicsSchema>;

export const ResumeExperienceItemSchema = z.object({
  company: z.string().default(""),
  position: z.string().default(""),
  location: z.string().optional().default(""),
  startDate: z.string().default(""),
  endDate: z.string().optional().default(""),
  current: z.boolean().default(false),
  description: z.string().optional().default(""),
  highlights: z.array(z.string()).default([]),
});
export type ResumeExperienceItem = z.infer<typeof ResumeExperienceItemSchema>;

export const ResumeEducationItemSchema = z.object({
  institution: z.string().default(""),
  degree: z.string().default(""),
  fieldOfStudy: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  gpa: z.string().optional().default(""),
  highlights: z.array(z.string()).default([]),
});
export type ResumeEducationItem = z.infer<typeof ResumeEducationItemSchema>;

export const ResumeSkillItemSchema = z.object({
  name: z.string().default(""),
  category: z.string().optional().default(""),
  level: z.string().optional().default(""),
  keywords: z.array(z.string()).default([]),
});
export type ResumeSkillItem = z.infer<typeof ResumeSkillItemSchema>;

export const ResumeProjectItemSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  url: z.string().optional().default(""),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});
export type ResumeProjectItem = z.infer<typeof ResumeProjectItemSchema>;

export const ResumeCertificationItemSchema = z.object({
  name: z.string().default(""),
  issuer: z.string().default(""),
  date: z.string().optional().default(""),
  url: z.string().optional().default(""),
});
export type ResumeCertificationItem = z.infer<
  typeof ResumeCertificationItemSchema
>;

export const ResumeDataSchema = z.object({
  basics: ResumeBasicsSchema,
  summary: z.string().default(""),
  experience: z.array(ResumeExperienceItemSchema).default([]),
  education: z.array(ResumeEducationItemSchema).default([]),
  skills: z.array(ResumeSkillItemSchema).default([]),
  projects: z.array(ResumeProjectItemSchema).default([]),
  certifications: z.array(ResumeCertificationItemSchema).default([]),
});
export type ResumeData = z.infer<typeof ResumeDataSchema>;
