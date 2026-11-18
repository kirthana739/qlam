import type { ResumeData } from "./schemas/resume.js";

export interface TruthCheckResult {
  ok: boolean;
  violations: string[];
}

/**
 * Normalizes strings by trimming and collapsing multiple spaces.
 */
function clean(str: string | undefined | null): string {
  return (str || "").trim().replace(/\s+/g, " ");
}

/**
 * Extracts all numeric tokens from text.
 * Matches:
 * - Integers, decimals (e.g. 10, 3.8, 1,000, 1000)
 * - Percentages (e.g. 40%, 25%)
 * - Currency / magnitudes (e.g. $5M, 10M, 100k, 2x)
 */
export function extractNumbers(text: string): { tokens: string[]; rawDigits: string[] } {
  if (!text) return { tokens: [], rawDigits: [] };

  // Match complete number tokens: e.g. "$10M", "40%", "1,000", "3.5", "10k"
  const tokenRegex = /(?:[\$€£])?\b\d+(?:[.,]\d+)*(?:%|[kKmMbBtT]|x|X)?(?!\w)/g;
  const rawDigitRegex = /\d+(?:\.\d+)?/g;

  const tokens = (text.match(tokenRegex) || []).map((t) => t.trim().toLowerCase());
  // Also extract stripped numeric values (removing commas: "1,000" -> "1000")
  const textWithoutCommas = text.replace(/(\d),(\d)/g, "$1$2");
  const rawDigits = (textWithoutCommas.match(rawDigitRegex) || []).map((d) => d.trim());

  return { tokens, rawDigits };
}

/**
 * Collects all text from bullet points and summaries across a resume.
 */
function collectBulletTexts(resume: ResumeData): string[] {
  const texts: string[] = [];

  if (resume.summary) {
    texts.push(resume.summary);
  }

  for (const exp of resume.experience || []) {
    if (exp.description) texts.push(exp.description);
    if (Array.isArray(exp.highlights)) {
      texts.push(...exp.highlights);
    }
  }

  for (const proj of resume.projects || []) {
    if (proj.description) texts.push(proj.description);
    if (Array.isArray(proj.highlights)) {
      texts.push(...proj.highlights);
    }
  }

  for (const edu of resume.education || []) {
    if (Array.isArray(edu.highlights)) {
      texts.push(...edu.highlights);
    }
  }

  return texts;
}

/**
 * Pure code truth-checking verification engine:
 * 1. Employers, titles, schools, degrees, dates must match base exactly.
 * 2. Skills must be a subset (case-insensitive).
 * 3. Every number in tailored bullets must appear in base.
 *
 * Returns { ok, violations }.
 */
export function truthCheck(base: ResumeData, tailored: ResumeData): TruthCheckResult {
  const violations: string[] = [];

  // --- 1. Employers, titles, and dates verification ---
  const baseExpByCompany = new Map<string, typeof base.experience>();
  for (const exp of base.experience || []) {
    const key = clean(exp.company).toLowerCase();
    const list = baseExpByCompany.get(key) || [];
    list.push(exp);
    baseExpByCompany.set(key, list);
  }

  if ((tailored.experience?.length || 0) > (base.experience?.length || 0)) {
    violations.push("Tailored resume has more experience entries than base resume");
  }

  for (const exp of tailored.experience || []) {
    const companyKey = clean(exp.company).toLowerCase();
    const baseMatches = baseExpByCompany.get(companyKey);

    if (!baseMatches || baseMatches.length === 0) {
      violations.push(`Invented employer: "${exp.company}"`);
      continue;
    }

    // Must match company name exactly
    const exactCompany = baseMatches.some((b) => clean(b.company) === clean(exp.company));
    if (!exactCompany) {
      violations.push(
        `Changed employer: "${exp.company}" does not match base company name "${baseMatches[0]?.company}"`
      );
    }

    // Must find an entry in base matching title (position), startDate, and endDate
    const matchingExp = baseMatches.find(
      (b) =>
        clean(b.position) === clean(exp.position) &&
        clean(b.startDate) === clean(exp.startDate) &&
        clean(b.endDate) === clean(exp.endDate)
    );

    if (!matchingExp) {
      // Pinpoint specific field mismatch for detailed diagnostic
      const titleMatch = baseMatches.find((b) => clean(b.position) === clean(exp.position));
      if (!titleMatch) {
        violations.push(
          `Changed title: "${exp.position}" at "${exp.company}" does not match base title "${baseMatches[0]?.position}"`
        );
      } else {
        if (clean(titleMatch.startDate) !== clean(exp.startDate)) {
          violations.push(
            `Changed start date: "${exp.startDate}" at "${exp.company}" does not match base "${titleMatch.startDate}"`
          );
        }
        if (clean(titleMatch.endDate) !== clean(exp.endDate)) {
          violations.push(
            `Changed end date: "${exp.endDate}" at "${exp.company}" does not match base "${titleMatch.endDate}"`
          );
        }
      }
    }
  }

  // --- 2. Schools, degrees, and dates verification ---
  const baseEduBySchool = new Map<string, typeof base.education>();
  for (const edu of base.education || []) {
    const key = clean(edu.institution).toLowerCase();
    const list = baseEduBySchool.get(key) || [];
    list.push(edu);
    baseEduBySchool.set(key, list);
  }

  if ((tailored.education?.length || 0) > (base.education?.length || 0)) {
    violations.push("Tailored resume has more education entries than base resume");
  }

  for (const edu of tailored.education || []) {
    const schoolKey = clean(edu.institution).toLowerCase();
    const baseEduMatches = baseEduBySchool.get(schoolKey);

    if (!baseEduMatches || baseEduMatches.length === 0) {
      violations.push(`Invented school: "${edu.institution}"`);
      continue;
    }

    const exactSchool = baseEduMatches.some((b) => clean(b.institution) === clean(edu.institution));
    if (!exactSchool) {
      violations.push(
        `Changed school: "${edu.institution}" does not match base "${baseEduMatches[0]?.institution}"`
      );
    }

    const matchingEdu = baseEduMatches.find(
      (b) =>
        clean(b.degree) === clean(edu.degree) &&
        clean(b.startDate) === clean(edu.startDate) &&
        clean(b.endDate) === clean(edu.endDate)
    );

    if (!matchingEdu) {
      const degreeMatch = baseEduMatches.find((b) => clean(b.degree) === clean(edu.degree));
      if (!degreeMatch) {
        violations.push(
          `Changed degree: "${edu.degree}" at "${edu.institution}" does not match base degree "${baseEduMatches[0]?.degree}"`
        );
      } else {
        if (clean(degreeMatch.startDate) !== clean(edu.startDate)) {
          violations.push(
            `Changed education start date: "${edu.startDate}" at "${edu.institution}" does not match base "${degreeMatch.startDate}"`
          );
        }
        if (clean(degreeMatch.endDate) !== clean(edu.endDate)) {
          violations.push(
            `Changed education end date: "${edu.endDate}" at "${edu.institution}" does not match base "${degreeMatch.endDate}"`
          );
        }
      }
    }
  }

  // --- 3. Skills subset verification (case-insensitive) ---
  const baseSkillsSet = new Set<string>();
  for (const skill of base.skills || []) {
    if (skill.name) baseSkillsSet.add(clean(skill.name).toLowerCase());
    for (const kw of skill.keywords || []) {
      if (kw) baseSkillsSet.add(clean(kw).toLowerCase());
    }
  }

  for (const skill of tailored.skills || []) {
    const nameKey = clean(skill.name).toLowerCase();
    if (nameKey && !baseSkillsSet.has(nameKey)) {
      violations.push(`Invented skill: "${skill.name}"`);
    }
    for (const kw of skill.keywords || []) {
      const kwKey = clean(kw).toLowerCase();
      if (kwKey && !baseSkillsSet.has(kwKey)) {
        violations.push(`Invented skill keyword: "${kw}" in category "${skill.name}"`);
      }
    }
  }

  // --- 4. Number verification in bullet highlights & summaries ---
  const baseTokensSet = new Set<string>();
  const baseDigitsSet = new Set<string>();

  const baseTexts = collectBulletTexts(base);
  for (const text of baseTexts) {
    const { tokens, rawDigits } = extractNumbers(text);
    for (const t of tokens) baseTokensSet.add(t);
    for (const d of rawDigits) baseDigitsSet.add(d);
  }

  // Also include dates and graduation years from base resume so valid dates are permitted
  for (const exp of base.experience || []) {
    for (const t of [exp.startDate, exp.endDate]) {
      const { tokens, rawDigits } = extractNumbers(t || "");
      for (const tok of tokens) baseTokensSet.add(tok);
      for (const d of rawDigits) baseDigitsSet.add(d);
    }
  }
  for (const edu of base.education || []) {
    for (const t of [edu.startDate, edu.endDate]) {
      const { tokens, rawDigits } = extractNumbers(t || "");
      for (const tok of tokens) baseTokensSet.add(tok);
      for (const d of rawDigits) baseDigitsSet.add(d);
    }
  }

  const tailoredTexts = collectBulletTexts(tailored);
  for (const text of tailoredTexts) {
    const { tokens, rawDigits } = extractNumbers(text);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      const digit = rawDigits[i];

      // A number is considered verified if its full token or its raw numeric value is present in base
      const tokenValid = baseTokensSet.has(token);
      const digitValid = digit ? baseDigitsSet.has(digit) : false;

      if (!tokenValid && !digitValid) {
        violations.push(`Invented number: "${token}" in tailored resume text: "${text}"`);
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}
