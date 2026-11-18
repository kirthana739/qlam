import {
  generateJSON,
  embed,
  ANSWER_QUESTION_SYSTEM_PROMPT,
  buildAnswerQuestionPrompt,
  AnswerQuestionOutputSchema,
  type QuestionToAsk,
  type AnswerResolutionResult,
} from "@qlam/core";
import type { FormField } from "./types.js";
import { isLegalOrEligibilityQuestion } from "./legalClassifier.js";

export interface BankAnswer {
  question_key: string;
  question_text: string;
  answer: string;
  embedding?: number[] | string | null;
}

export interface CandidateProfileContext {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  links?: Record<string, string> | null;
  work_authorization?: string | null;
  needs_sponsorship?: boolean;
  notice_period_days?: number | null;
  expected_salary?: string | null;
  preferences?: Record<string, unknown> | null;
  skills?: string[];
  experience?: Array<{
    position?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    fieldOfStudy?: string;
    graduationDate?: string;
  }>;
  summary?: string;
  inbox_alias?: string;
}

export interface JobContext {
  title: string;
  companyName: string;
  location?: string | null;
  descriptionText?: string | null;
}

export interface ResolveFieldOptions {
  field: FormField;
  answers: BankAnswer[];
  profile: CandidateProfileContext;
  job: JobContext;
  embedFn?: (text: string) => Promise<number[]>;
  aiGenerateFn?: (prompt: string, system?: string) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>;
}

export interface ResolveFormFieldsResult {
  filledFields: Record<string, string>;
  resolvedAnswers: Record<string, AnswerResolutionResult>;
  questionsNeedingUser: QuestionToAsk[];
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseVector(vec: number[] | string | null | undefined): number[] | null {
  if (!vec) return null;
  if (Array.isArray(vec)) return vec;
  if (typeof vec === "string") {
    try {
      const parsed = JSON.parse(vec);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      const parts = vec.replace(/[\[\]]/g, "").split(",").map((v) => parseFloat(v.trim()));
      const first = parts[0];
      if (parts.length > 0 && typeof first === "number" && !isNaN(first)) return parts;
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function matchOption(target: string, options?: string[]): string {
  if (!options || options.length === 0) return target;
  const normTarget = normalize(target);

  // Exact normalized match
  for (const opt of options) {
    if (normalize(opt) === normTarget) return opt;
  }

  // Substring or prefix match
  for (const opt of options) {
    const normOpt = normalize(opt);
    if (normOpt.includes(normTarget) || normTarget.includes(normOpt)) {
      return opt;
    }
  }

  // Boolean shorthand: "Yes" / "No"
  if (normTarget === "yes" || normTarget === "true") {
    const yesOpt = options.find((o) => /^yes\b/i.test(o.trim()) || normalize(o) === "yes");
    if (yesOpt) return yesOpt;
  }
  if (normTarget === "no" || normTarget === "false") {
    const noOpt = options.find((o) => /^no\b/i.test(o.trim()) || normalize(o) === "no");
    if (noOpt) return noOpt;
  }

  return target;
}

/**
 * Step 1: Answers Bank lookup (question_key exact, then question_text embedding similarity)
 */
export async function resolveFromBank(
  field: FormField,
  answers: BankAnswer[],
  embedFn?: (text: string) => Promise<number[]>
): Promise<AnswerResolutionResult | null> {
  if (!answers || answers.length === 0) return null;

  const fieldKey = field.name ? normalize(field.name) : "";
  const fieldLabelNorm = normalize(field.label);

  // 1a. Exact or normalized question_key match
  if (fieldKey) {
    const keyMatch = answers.find(
      (a) => normalize(a.question_key) === fieldKey || normalize(a.question_key).includes(fieldKey)
    );
    if (keyMatch) {
      return {
        answer: matchOption(keyMatch.answer, field.options),
        confidence: 1.0,
        source: "bank",
        usedFacts: [`Banked answer for key: ${keyMatch.question_key}`],
        isLegalOrEligibility: isLegalOrEligibilityQuestion(field.label, field.name),
      };
    }
  }

  // 1b. Exact normalized question_text match
  const textMatch = answers.find((a) => {
    const aTextNorm = normalize(a.question_text);
    return aTextNorm === fieldLabelNorm || aTextNorm.includes(fieldLabelNorm) || fieldLabelNorm.includes(aTextNorm);
  });
  if (textMatch) {
    return {
      answer: matchOption(textMatch.answer, field.options),
      confidence: 1.0,
      source: "bank",
      usedFacts: [`Banked answer for question text: ${textMatch.question_text}`],
      isLegalOrEligibility: isLegalOrEligibilityQuestion(field.label, field.name),
    };
  }

  // 1c. Semantic similarity via embedding (threshold >= 0.85)
  if (embedFn) {
    try {
      const fieldEmbedding = await embedFn(field.label);
      let bestSimilarity = 0;
      let bestAnswer: BankAnswer | null = null;

      for (const a of answers) {
        const storedVec = parseVector(a.embedding);
        if (storedVec && storedVec.length === fieldEmbedding.length) {
          const sim = cosineSimilarity(fieldEmbedding, storedVec);
          if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestAnswer = a;
          }
        }
      }

      if (bestAnswer && bestSimilarity >= 0.85) {
        return {
          answer: matchOption(bestAnswer.answer, field.options),
          confidence: Number(bestSimilarity.toFixed(2)),
          source: "bank",
          usedFacts: [`Bank semantic match (similarity ${bestSimilarity.toFixed(2)}) for "${bestAnswer.question_text}"`],
          isLegalOrEligibility: isLegalOrEligibilityQuestion(field.label, field.name),
        };
      }
    } catch (err) {
      // Non-blocking fallback
    }
  }

  return null;
}

/**
 * Step 2: Profile mapping table lookup
 */
export function resolveFromProfile(
  field: FormField,
  profile: CandidateProfileContext
): AnswerResolutionResult | null {
  const labelLower = field.label.toLowerCase();
  const nameLower = (field.name || "").toLowerCase();

  // Work authorization
  if (
    labelLower.includes("authorized to work") ||
    labelLower.includes("legal authorization") ||
    labelLower.includes("work authorization") ||
    nameLower.includes("work_auth")
  ) {
    const val = profile.work_authorization || "Yes";
    return {
      answer: matchOption(val, field.options),
      confidence: 1.0,
      source: "profile",
      usedFacts: [`Profile work_authorization: ${val}`],
      isLegalOrEligibility: true,
    };
  }

  // Sponsorship
  if (
    labelLower.includes("sponsorship") ||
    labelLower.includes("require visa") ||
    labelLower.includes("visa sponsorship") ||
    nameLower.includes("sponsorship")
  ) {
    const val = profile.needs_sponsorship ? "Yes" : "No";
    return {
      answer: matchOption(val, field.options),
      confidence: 1.0,
      source: "profile",
      usedFacts: [`Profile needs_sponsorship: ${profile.needs_sponsorship}`],
      isLegalOrEligibility: true,
    };
  }

  // Notice period
  if (
    labelLower.includes("notice period") ||
    nameLower.includes("notice_period")
  ) {
    if (profile.notice_period_days !== undefined && profile.notice_period_days !== null) {
      let val = `${profile.notice_period_days} days`;
      if (profile.notice_period_days === 0) val = "Immediate";
      else if (profile.notice_period_days === 14) val = "2 weeks";
      else if (profile.notice_period_days === 30) val = "1 month";
      return {
        answer: matchOption(val, field.options),
        confidence: 1.0,
        source: "profile",
        usedFacts: [`Profile notice_period_days: ${profile.notice_period_days}`],
        isLegalOrEligibility: false,
      };
    }
  }

  // Expected salary
  if (
    labelLower.includes("expected salary") ||
    labelLower.includes("desired salary") ||
    labelLower.includes("compensation expectation") ||
    nameLower.includes("salary")
  ) {
    if (profile.expected_salary) {
      return {
        answer: matchOption(profile.expected_salary, field.options),
        confidence: 1.0,
        source: "profile",
        usedFacts: [`Profile expected_salary: ${profile.expected_salary}`],
        isLegalOrEligibility: false,
      };
    }
  }

  // Links (LinkedIn, GitHub, Portfolio)
  const links = profile.links || {};
  if (labelLower.includes("linkedin") || nameLower.includes("linkedin")) {
    const link = links.linkedin || links.LinkedIn || links.Linkedin;
    if (link) {
      return {
        answer: link,
        confidence: 1.0,
        source: "profile",
        usedFacts: ["Profile LinkedIn URL"],
        isLegalOrEligibility: false,
      };
    }
  }

  if (labelLower.includes("github") || nameLower.includes("github")) {
    const link = links.github || links.GitHub;
    if (link) {
      return {
        answer: link,
        confidence: 1.0,
        source: "profile",
        usedFacts: ["Profile GitHub URL"],
        isLegalOrEligibility: false,
      };
    }
  }

  if (
    labelLower.includes("portfolio") ||
    labelLower.includes("personal website") ||
    nameLower.includes("website") ||
    nameLower.includes("portfolio")
  ) {
    const link = links.portfolio || links.website || links.Portfolio || links.Website;
    if (link) {
      return {
        answer: link,
        confidence: 1.0,
        source: "profile",
        usedFacts: ["Profile portfolio/website URL"],
        isLegalOrEligibility: false,
      };
    }
  }

  // Preferences (e.g. work style, remote, relocation)
  const prefs = (profile.preferences || {}) as Record<string, unknown>;
  if (labelLower.includes("work style") || labelLower.includes("work arrangement") || labelLower.includes("work mode")) {
    const prefStyle = (prefs.work_mode || prefs.work_style || prefs.location_type) as string | undefined;
    if (prefStyle) {
      return {
        answer: matchOption(prefStyle, field.options),
        confidence: 1.0,
        source: "profile",
        usedFacts: [`Profile preference: ${prefStyle}`],
        isLegalOrEligibility: false,
      };
    }
  }

  if (labelLower.includes("relocate") || labelLower.includes("relocation")) {
    const willing = prefs.willing_to_relocate !== undefined ? (prefs.willing_to_relocate ? "Yes" : "No") : undefined;
    if (willing) {
      return {
        answer: matchOption(willing, field.options),
        confidence: 1.0,
        source: "profile",
        usedFacts: [`Profile relocation preference: ${willing}`],
        isLegalOrEligibility: false,
      };
    }
  }

  return null;
}

/**
 * Step 3: AI Answering with grounding and confidence scoring
 */
export async function resolveWithAI(
  field: FormField,
  profile: CandidateProfileContext,
  job: JobContext,
  aiGenerateFn?: (prompt: string, system?: string) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>
): Promise<AnswerResolutionResult> {
  const prompt = buildAnswerQuestionPrompt({
    question: {
      label: field.label,
      name: field.name,
      type: field.type,
    },
    options: field.options,
    profile,
    job,
  });

  if (aiGenerateFn) {
    const res = await aiGenerateFn(prompt, ANSWER_QUESTION_SYSTEM_PROMPT);
    return {
      answer: matchOption(res.answer, field.options),
      confidence: res.confidence,
      source: "ai",
      usedFacts: res.usedFacts || [],
      isLegalOrEligibility: false,
    };
  }

  // Call standard @qlam/core generateJSON
  try {
    const output = await generateJSON({
      system: ANSWER_QUESTION_SYSTEM_PROMPT,
      prompt,
      schema: AnswerQuestionOutputSchema,
    });

    return {
      answer: matchOption(output.answer, field.options),
      confidence: output.confidence,
      source: "ai",
      usedFacts: output.usedFacts,
      isLegalOrEligibility: false,
    };
  } catch (err) {
    return {
      answer: null,
      confidence: 0,
      source: "none",
      usedFacts: [],
      isLegalOrEligibility: false,
    };
  }
}

/**
 * Resolves a single field following the strict priority chain:
 * 1. Bank (key, then semantic embedding)
 * 2. Profile mapping
 * 3. Legal Guardrail (if legal/eligibility -> never call AI)
 * 4. AI generation (ai.generateJSON)
 */
export async function resolveFieldAnswer(
  options: ResolveFieldOptions
): Promise<AnswerResolutionResult> {
  const { field, answers, profile, job, aiGenerateFn } = options;
  const embedFn =
    options.embedFn ||
    (process.env.GEMINI_API_KEY && process.env.GEMINI_EMBED_MODEL
      ? async (t: string) => {
          const [v] = await embed([t]);
          return v || [];
        }
      : undefined);
  const isLegal = isLegalOrEligibilityQuestion(field.label, field.name);

  // 1. Bank
  const bankResult = await resolveFromBank(field, answers, embedFn);
  if (bankResult) {
    return bankResult;
  }

  // 2. Profile Mapping Table
  const profileResult = resolveFromProfile(field, profile);
  if (profileResult) {
    return profileResult;
  }

  // 3. Legal/Eligibility Guardrail: Never goes to AI!
  if (isLegal) {
    return {
      answer: null,
      confidence: 0,
      source: "none",
      usedFacts: [],
      isLegalOrEligibility: true,
    };
  }

  // 4. AI generation
  return await resolveWithAI(field, profile, job, aiGenerateFn);
}

/**
 * Resolves all custom fields in a form, separating successfully answered fields
 * from required questions requiring user input.
 */
export async function resolveFormFields(
  fields: FormField[],
  context: {
    answers: BankAnswer[];
    profile: CandidateProfileContext;
    job: JobContext;
    embedFn?: (text: string) => Promise<number[]>;
    aiGenerateFn?: (prompt: string, system?: string) => Promise<{ answer: string; confidence: number; usedFacts: string[] }>;
  }
): Promise<ResolveFormFieldsResult> {
  const filledFields: Record<string, string> = {};
  const resolvedAnswers: Record<string, AnswerResolutionResult> = {};
  const questionsNeedingUser: QuestionToAsk[] = [];

  for (const field of fields) {
    const result = await resolveFieldAnswer({
      field,
      answers: context.answers,
      profile: context.profile,
      job: context.job,
      embedFn: context.embedFn,
      aiGenerateFn: context.aiGenerateFn,
    });

    resolvedAnswers[field.label] = result;

    if (result.answer && result.confidence >= 0.8) {
      filledFields[field.label] = result.answer;
    } else if (field.required) {
      questionsNeedingUser.push({
        key: field.name || field.label.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        text: field.label,
        type: field.type,
        options: field.options,
        required: field.required,
        selector: field.selector,
      });
    }
  }

  return {
    filledFields,
    resolvedAnswers,
    questionsNeedingUser,
  };
}
