import { politeFetch, htmlToPlainText, isRemoteLocation } from "../utils/http.js";
import { type NormalizedJob } from "./types.js";

interface GreenhouseJobRaw {
  id: number;
  title: string;
  updated_at?: string;
  absolute_url: string;
  location?: {
    name?: string;
  };
  departments?: Array<{
    id: number;
    name: string;
  }>;
  content?: string;
  [key: string]: unknown;
}

interface GreenhouseBoardResponse {
  jobs?: GreenhouseJobRaw[];
}

interface GreenhouseJobDetailResponse {
  questions?: unknown[];
  [key: string]: unknown;
}

/**
 * Fetch all jobs for a Greenhouse board token.
 */
export async function fetchGreenhouseJobs(boardToken: string): Promise<NormalizedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const res = await politeFetch(url);

  if (!res.ok) {
    throw new Error(`Greenhouse API error ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as GreenhouseBoardResponse;
  const rawJobs = data.jobs || [];

  return rawJobs.map((job) => {
    const location = job.location?.name?.trim() || null;
    const department = job.departments?.[0]?.name?.trim() || null;
    const descriptionText = htmlToPlainText(job.content);

    return {
      externalId: String(job.id),
      title: job.title.trim(),
      location,
      isRemote: isRemoteLocation(location),
      department,
      descriptionText,
      applyUrl: job.absolute_url,
      postedAt: job.updated_at ? new Date(job.updated_at).toISOString() : null,
      raw: job,
    };
  });
}

/**
 * Fetch detailed questions for a specific Greenhouse job.
 */
export async function fetchGreenhouseJobQuestions(
  boardToken: string,
  jobId: string
): Promise<unknown[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}?questions=true`;
  const res = await politeFetch(url);

  if (!res.ok) {
    return [];
  }

  const detail = (await res.json()) as GreenhouseJobDetailResponse;
  return detail.questions || [];
}
