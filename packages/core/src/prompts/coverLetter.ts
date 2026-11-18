import { z } from "zod";
import { generateJSON } from "../ai.js";
import type { ResumeData } from "../schemas/resume.js";

export const CoverLetterOutputSchema = z.object({
  coverLetter: z.string().describe("A concise cover letter of 150 words or fewer."),
  wordCount: z.number().int().optional(),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterOutputSchema>;

export interface CoverLetterInput {
  baseResume: ResumeData;
  jobTitle: string;
  companyName?: string;
  jobDescription: string;
}

export const COVER_LETTER_SYSTEM_PROMPT = `You are a concise, truthful cover letter writer for job applicants.

STRICT RULES:
1. WORD LIMIT: Maximum 150 words. Be direct, compelling, and punchy. No fluff or boilerplate filler.
2. STRICT TRUTH:
   - Only reference companies, past titles, degrees, skills, and metrics that actually appear in the applicant's resume.
   - Never invent or exaggerate past achievements, years of experience, or responsibilities.
3. STRUCTURE:
   - Paragraph 1: Why the candidate is excited about this specific role at this specific company.
   - Paragraph 2: Top 1-2 most relevant verified achievements demonstrating fit.
   - Paragraph 3: Brief wrap-up and forward-looking closing.

Return strictly valid JSON with the "coverLetter" string.`;

export function buildCoverLetterPrompt({
  baseResume,
  jobTitle,
  companyName,
  jobDescription,
}: CoverLetterInput): string {
  return `Write a truthful, highly targeted cover letter (under 150 words) for the following role.

JOB DETAILS:
- Role: ${jobTitle}
- Company: ${companyName || "the team"}
- Description:
${jobDescription}

APPLICANT'S VERIFIED RESUME:
${JSON.stringify(baseResume, null, 2)}

Ensure the total word count is 150 words or fewer, citing only real achievements from the resume above.`;
}

/**
 * Generates a truthful cover letter strictly under 150 words.
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<CoverLetterOutput> {
  const prompt = buildCoverLetterPrompt(input);
  return generateJSON({
    system: COVER_LETTER_SYSTEM_PROMPT,
    prompt,
    schema: CoverLetterOutputSchema,
  });
}
