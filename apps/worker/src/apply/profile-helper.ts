import type { Database } from "@qlam/core";
import type { CandidateProfileContext } from "./answerEngine.js";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function buildProfileContext(
  profile: ProfileRow,
  parsedResume: Record<string, unknown>
): CandidateProfileContext {
  return {
    name: profile.name,
    phone: profile.phone,
    city: profile.city,
    links: profile.links as Record<string, string> | null,
    work_authorization: profile.work_authorization,
    needs_sponsorship: profile.needs_sponsorship,
    notice_period_days: profile.notice_period_days,
    expected_salary: profile.expected_salary,
    preferences: profile.preferences as Record<string, unknown> | null,
    skills: Array.isArray(parsedResume.skills)
      ? (parsedResume.skills as string[])
      : undefined,
    experience: Array.isArray(parsedResume.experience)
      ? (parsedResume.experience as CandidateProfileContext["experience"])
      : undefined,
    education: Array.isArray(parsedResume.education)
      ? (parsedResume.education as CandidateProfileContext["education"])
      : undefined,
    summary:
      typeof parsedResume.summary === "string" ? parsedResume.summary : undefined,
    inbox_alias: profile.inbox_alias,
  };
}
