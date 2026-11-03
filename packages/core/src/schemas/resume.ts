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
  url: z.string().url(),
});
export type ResumeLink = z.infer<typeof ResumeLinkSchema>;

export const ResumeBasicsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  headline: z.string().optional(),
  location: ResumeBasicsLocationSchema.optional(),
  links: z.array(ResumeLinkSchema).default([]),
});
export type ResumeBasics = z.infer<typeof ResumeBasicsSchema>;

export const ResumeExperienceItemSchema = z.object({
  company: z.string().min(1),
  position: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  description: z.string().optional(),
  highlights: z.array(z.string()).default([]),
});
export type ResumeExperienceItem = z.infer<typeof ResumeExperienceItemSchema>;

export const ResumeEducationItemSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
  highlights: z.array(z.string()).default([]),
});
export type ResumeEducationItem = z.infer<typeof ResumeEducationItemSchema>;

export const ResumeSkillItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).default([]),
});
export type ResumeSkillItem = z.infer<typeof ResumeSkillItemSchema>;

export const ResumeProjectItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  url: z.string().url().optional().or(z.literal("")),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});
export type ResumeProjectItem = z.infer<typeof ResumeProjectItemSchema>;

export const ResumeCertificationItemSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().min(1),
  date: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
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
