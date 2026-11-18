import { z } from "zod";

export const QUESTION_KEYS = {
  WORK_AUTHORIZATION: "work_authorization",
  SPONSORSHIP: "sponsorship",
  NOTICE_PERIOD: "notice_period",
  EXPECTED_SALARY: "expected_salary",
  YEARS_OF_EXPERIENCE: "years_of_experience",
  WILLING_TO_RELOCATE: "willing_to_relocate",
  HOW_HEARD: "how_heard",
  GENDER: "gender",
  RACE_ETHNICITY: "race_ethnicity",
  VETERAN_STATUS: "veteran_status",
  DISABILITY_STATUS: "disability_status",
} as const;

export type QuestionKey = (typeof QUESTION_KEYS)[keyof typeof QUESTION_KEYS];

export interface QuestionDefinition {
  key: QuestionKey;
  label: string;
  questionText: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  isDemographic?: boolean;
}

export const COMMON_QUESTIONS: QuestionDefinition[] = [
  {
    key: QUESTION_KEYS.WORK_AUTHORIZATION,
    label: "Work Authorization",
    questionText: "Are you legally authorized to work in your target country?",
    options: [
      "Authorized to work with no visa restrictions",
      "Authorized with visa / temporary permit",
      "Not authorized without visa sponsorship",
    ],
    defaultValue: "Authorized to work with no visa restrictions",
  },
  {
    key: QUESTION_KEYS.SPONSORSHIP,
    label: "Visa Sponsorship",
    questionText: "Will you now or in the future require visa sponsorship?",
    options: ["No", "Yes"],
    defaultValue: "No",
  },
  {
    key: QUESTION_KEYS.NOTICE_PERIOD,
    label: "Notice Period",
    questionText: "What is your current notice period?",
    options: [
      "Immediate",
      "2 weeks",
      "1 month",
      "2 months",
      "3 months",
      "More than 3 months",
    ],
    defaultValue: "Immediate",
  },
  {
    key: QUESTION_KEYS.EXPECTED_SALARY,
    label: "Expected Salary",
    questionText: "What is your expected annual compensation?",
    placeholder: "e.g. $120,000 / year or £85,000 / year",
    defaultValue: "$120,000",
  },
  {
    key: QUESTION_KEYS.YEARS_OF_EXPERIENCE,
    label: "Years of Experience",
    questionText: "How many total years of relevant professional experience do you have?",
    options: ["0-1 years", "2-3 years", "4-6 years", "7-10 years", "10+ years"],
    defaultValue: "4-6 years",
  },
  {
    key: QUESTION_KEYS.WILLING_TO_RELOCATE,
    label: "Willing to Relocate",
    questionText: "Are you willing to relocate for this position?",
    options: ["Yes", "No", "Remote only"],
    defaultValue: "Yes",
  },
  {
    key: QUESTION_KEYS.HOW_HEARD,
    label: "How did you hear about the job?",
    questionText: "How did you hear about this opportunity?",
    options: [
      "Qlam AI Job Search",
      "LinkedIn",
      "Job Board",
      "Company Website",
      "Referral",
      "Other",
    ],
    defaultValue: "Qlam AI Job Search",
  },
  {
    key: QUESTION_KEYS.GENDER,
    label: "Gender",
    questionText: "What is your gender?",
    options: [
      "Decline to self-identify",
      "Man",
      "Woman",
      "Non-binary",
      "Other",
    ],
    defaultValue: "Decline to self-identify",
    isDemographic: true,
  },
  {
    key: QUESTION_KEYS.RACE_ETHNICITY,
    label: "Race / Ethnicity",
    questionText: "What is your race / ethnicity?",
    options: [
      "Decline to self-identify",
      "Asian",
      "Black or African American",
      "Hispanic or Latino",
      "White",
      "Native American or Alaska Native",
      "Native Hawaiian or Other Pacific Islander",
      "Two or More Races",
    ],
    defaultValue: "Decline to self-identify",
    isDemographic: true,
  },
  {
    key: QUESTION_KEYS.VETERAN_STATUS,
    label: "Veteran Status",
    questionText: "What is your veteran status?",
    options: [
      "Decline to self-identify",
      "I am not a protected veteran",
      "I identify as one or more classifications of protected veteran",
    ],
    defaultValue: "Decline to self-identify",
    isDemographic: true,
  },
  {
    key: QUESTION_KEYS.DISABILITY_STATUS,
    label: "Disability Status",
    questionText: "What is your disability status?",
    options: [
      "Decline to self-identify",
      "No, I do not have a disability and have not had one in the past",
      "Yes, I have a disability (or previously had a disability)",
    ],
    defaultValue: "Decline to self-identify",
    isDemographic: true,
  },
];

export const AnswerItemSchema = z.object({
  question_key: z.string().min(1),
  question_text: z.string().min(1),
  answer: z.string().min(1),
  source: z.enum(["user", "ai"]).default("user"),
});
export type AnswerItem = z.infer<typeof AnswerItemSchema>;

export const CommonAnswersMapSchema = z.record(z.string(), z.string());
export type CommonAnswersMap = z.infer<typeof CommonAnswersMapSchema>;

export const QuestionToAskSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  type: z.enum([
    "text",
    "email",
    "tel",
    "url",
    "textarea",
    "select",
    "file",
    "checkbox",
    "radio",
    "other",
  ]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  selector: z.string().optional(),
});
export type QuestionToAsk = z.infer<typeof QuestionToAskSchema>;

export const AnswerResolutionResultSchema = z.object({
  answer: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["bank", "profile", "ai", "none"]),
  usedFacts: z.array(z.string()).default([]),
  isLegalOrEligibility: z.boolean().default(false),
});
export type AnswerResolutionResult = z.infer<typeof AnswerResolutionResultSchema>;

