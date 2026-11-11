import { politeFetch, htmlToPlainText, isRemoteLocation } from "../utils/http.js";
import { type NormalizedJob } from "./types.js";

interface LeverJobRaw {
  id: string;
  text: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
  hostedUrl: string;
  applyUrl?: string;
  workplaceType?: string;
  categories?: {
    location?: string;
    department?: string;
    team?: string;
    commitment?: string;
  };
  [key: string]: unknown;
}

/**
 * Fetch all postings for a Lever site token, falling back to EU endpoint on 404.
 */
export async function fetchLeverJobs(site: string): Promise<NormalizedJob[]> {
  const primaryUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
  let res = await politeFetch(primaryUrl);

  // Fallback to EU endpoint on 404
  if (res.status === 404) {
    const euUrl = `https://api.eu.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
    res = await politeFetch(euUrl);
  }

  if (!res.ok) {
    throw new Error(`Lever API error ${res.status}: ${res.statusText}`);
  }

  const rawJobs = (await res.json()) as LeverJobRaw[];

  return rawJobs.map((job) => {
    const location = job.categories?.location?.trim() || null;
    const department =
      job.categories?.department?.trim() || job.categories?.team?.trim() || null;
    const descriptionText =
      job.descriptionPlain?.trim() || htmlToPlainText(job.description);
    const isExplicitRemote = job.workplaceType?.toLowerCase() === "remote";

    return {
      externalId: job.id,
      title: job.text.trim(),
      location,
      isRemote: isRemoteLocation(location, isExplicitRemote),
      department,
      descriptionText,
      applyUrl: job.applyUrl || job.hostedUrl,
      postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      raw: job,
    };
  });
}
