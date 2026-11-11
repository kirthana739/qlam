export const PARSE_RESUME_SYSTEM_PROMPT =
  "Extract only what is written. Leave missing fields empty. Never guess or add anything.";

export function buildParseResumePrompt(resumeText: string): string {
  return `Extract the resume data from the text below into the structured JSON schema.

RULES:
1. Extract only what is written. Leave missing fields empty or omit them.
2. Never invent or hallucinate employers, dates, titles, degrees, or skills.
3. For links and URLs (e.g. LinkedIn, GitHub, portfolio), include the full URL if found (ensure it starts with https:// or http://).
4. Return strictly valid JSON adhering to the schema.

RESUME TEXT:
${resumeText}
`;
}
