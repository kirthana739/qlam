import { politeFetch, htmlToPlainText, isRemoteLocation } from "../utils/http.js";
import { type NormalizedJob } from "./types.js";

interface AshbyJobRaw {
  id: string;
  title: string;
  department?: string;
  team?: string;
  location?: string;
  isRemote?: boolean;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  jobUrl?: string;
  applyUrl?: string;
  [key: string]: unknown;
}

interface AshbyBoardResponse {
  jobs?: AshbyJobRaw[];
}

/**
 * Fetch all postings for an Ashby job board name.
 */
export async function fetchAshbyJobs(name: string): Promise<NormalizedJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(name)}?includeCompensation=true`;
  const res = await politeFetch(url);

  if (!res.ok) {
    throw new Error(`Ashby API error ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as AshbyBoardResponse;
  const rawJobs = data.jobs || [];

  return rawJobs.map((job) => {
    const location = job.location?.trim() || null;
    const department = job.department?.trim() || job.team?.trim() || null;
    const descriptionText =
      job.descriptionPlain?.trim() || htmlToPlainText(job.descriptionHtml);

    return {
      externalId: job.id,
      title: job.title.trim(),
      location,
      isRemote: isRemoteLocation(location, job.isRemote === true),
      department,
      descriptionText,
      applyUrl: job.applyUrl || job.jobUrl || "",
      postedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : null,
      raw: job,
    };
  });
}
