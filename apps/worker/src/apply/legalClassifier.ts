/**
/**
 * Legal and eligibility question classifier for Qlam.
 *
 * CRITICAL RULE: Legal/eligibility questions (authorization, sponsorship,
 * criminal record, age, disability, gender, race, veteran) never go to AI.
 * They must be answered from the bank, the profile, or asked to the user.
 */

export const LEGAL_CATEGORIES = {
  AUTHORIZATION: "authorization",
  SPONSORSHIP: "sponsorship",
  CRIMINAL_RECORD: "criminal_record",
  AGE: "age",
  DISABILITY: "disability",
  GENDER: "gender",
  RACE_ETHNICITY: "race_ethnicity",
  VETERAN: "veteran",
} as const;

export type LegalCategory = (typeof LEGAL_CATEGORIES)[keyof typeof LEGAL_CATEGORIES];

const LEGAL_PATTERNS: Record<LegalCategory, RegExp> = {
  authorization:
    /\b(authorized\s+to\s+work|work\s+authoriz|legal(ly)?\s+authoriz|eligible\s+to\s+work|right\s+to\s+work|employment\s+eligib)\b/i,
  sponsorship:
    /\b(sponsor(ship)?|visa|require\s+visa|need\s+visa|h-?1b|opt\b|cpt\b)\b/i,
  criminal_record:
    /\b(criminal|convict(ed|ion)?|felon(y)?|misdemeanor|background\s+check)\b/i,
  age:
    /\b(18\s+years|age|over\s+18|legal\s+age|minimum\s+age|at\s+least\s+18)\b/i,
  disability:
    /\b(disabilit(y|ies)|handicap|impairment|reasonable\s+accommodation)\b/i,
  gender:
    /\b(gender|sex|pronoun(s)?|identify\s+as\s+a\s+(man|woman))\b/i,
  race_ethnicity:
    /\b(race|ethnicity|hispanic|latino|latina|caucasian|african\s+american|asian|indigenous|pacific\s+islander)\b/i,
  veteran:
    /\b(veteran|military|armed\s+forces|protected\s+veteran|active\s+duty)\b/i,
};

const LEGAL_KEY_PATTERNS = [
  "work_authorization",
  "work_auth",
  "sponsorship",
  "visa",
  "criminal",
  "felony",
  "age",
  "over_18",
  "disability",
  "gender",
  "race",
  "ethnicity",
  "veteran",
];

export function classifyLegalCategory(text: string, key?: string): LegalCategory | null {
  const combined = `${key || ""} ${text}`.toLowerCase();

  for (const [category, pattern] of Object.entries(LEGAL_PATTERNS) as [LegalCategory, RegExp][]) {
    if (pattern.test(combined)) {
      return category;
    }
  }

  if (key) {
    const normKey = key.toLowerCase();
    for (const pattern of LEGAL_KEY_PATTERNS) {
      if (normKey.includes(pattern)) {
        return "authorization";
      }
    }
  }

  return null;
}

export function isLegalOrEligibilityQuestion(text: string, key?: string): boolean {
  return classifyLegalCategory(text, key) !== null;
}
