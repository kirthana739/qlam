import { generateJSON } from "../ai.js";
import { ResumeDataSchema, type ResumeData } from "../schemas/resume.js";
import type { TailoringStrength } from "../schemas/preferences.js";

export interface TailorResumeInput {
  baseResume: ResumeData;
  jobTitle: string;
  jobDescription: string;
  companyName?: string;
  strength?: TailoringStrength;
}

export const TAILOR_RESUME_SYSTEM_PROMPT = `You are a precision resume tailoring assistant.
Your task is to adapt an applicant's real resume to match a specific job description.

CRITICAL RULES - STRICT TRUTH ENFORCEMENT:
1. NEVER INVENT FACTS:
   - Never add employers, job titles, institutions/schools, degrees, or dates. They must match the applicant's base resume EXACTLY.
   - Never add new skills. Every skill in the output must be a subset of the skills listed in the base resume (case-insensitive).
   - Never invent or change metrics or numbers. Every number, percentage, currency figure, team size, or count must come directly from the base resume.
2. PUT RELEVANT TRUTH FIRST:
   - Highlight and prioritize the experiences, projects, and skills most relevant to the target role.
   - Reorder bullets so the strongest, most pertinent achievements appear first.
3. USE JOB WORDING ONLY WHERE TRUTHFUL:
   - Align action verbs and terminology with the job description only when describing actual work done in the base resume.
4. STRENGTH MODES:
   - "light": Only reorder existing bullet points and skills by relevance. Keep original phrasing intact.
   - "medium": Reorder bullets/skills; gently rephrase bullets using relevant job terminology where completely truthful to base facts.
   - "strong": Actively rephrase and prioritize bullets and summary to emphasize qualifications sought by the role, omitting less relevant bullets, while strictly preserving all facts, dates, titles, employers, degrees, skills subset, and exact numbers.

Return strictly valid JSON matching the ResumeData schema.`;

export function buildTailorResumePrompt({
  baseResume,
  jobTitle,
  jobDescription,
  companyName,
  strength = "medium",
}: TailorResumeInput): string {
  // Collect base skills for explicit prompt guidance
  const allowedSkills: string[] = [];
  for (const skill of baseResume.skills || []) {
    if (skill.name) allowedSkills.push(skill.name);
    if (skill.keywords) allowedSkills.push(...skill.keywords);
  }

  // Collect base numbers for explicit prompt guidance
  const numbersInBase: string[] = [];
  const textBlob = JSON.stringify(baseResume);
  const matchedTokens = textBlob.match(/(?:[\$€£])?\b\d+(?:[.,]\d+)*(?:%|[kKmMbBtT]|x|X)?(?!\w)/g) || [];
  for (const tok of matchedTokens) {
    if (!numbersInBase.includes(tok)) numbersInBase.push(tok);
  }

  return `Tailor the applicant's base resume for the following job posting.

TARGET JOB:
- Title: ${jobTitle}
- Company: ${companyName || "Target Company"}
- Description:
${jobDescription}

TAILORING STRENGTH: "${strength}"

ALLOWED SKILLS (You may ONLY choose from this list, do not introduce any other skills):
${allowedSkills.join(", ")}

ALLOWED NUMBERS / METRICS (Every number in your output must appear in this list):
${numbersInBase.join(", ")}

APPLICANT'S BASE RESUME JSON:
${JSON.stringify(baseResume, null, 2)}

Instructions:
1. Produce a tailored ResumeData JSON object.
2. Keep basic contact info, education (schools, degrees, dates), and experience (companies, titles, dates) matching base resume exactly.
3. Prioritize the most relevant bullets and skills for this ${jobTitle} role.
4. Output valid JSON adhering to the ResumeData schema.`;
}

/**
 * Generates a truthful tailored resume using Gemini AI via packages/core/src/ai.ts
 */
export async function tailorResume(input: TailorResumeInput): Promise<ResumeData> {
  const prompt = buildTailorResumePrompt(input);
  return generateJSON({
    system: TAILOR_RESUME_SYSTEM_PROMPT,
    prompt,
    schema: ResumeDataSchema,
  });
}
