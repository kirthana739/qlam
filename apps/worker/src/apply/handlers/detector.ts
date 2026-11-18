import type { AtsType } from "@qlam/core";

export interface AtsDetectionResult {
  ats: AtsType | null;
  hostname: string;
  isSupported: boolean;
  reason?: string;
}

export const SUPPORTED_ATS_HOSTNAMES: Record<string, AtsType> = {
  "boards.greenhouse.io": "greenhouse",
  "job-boards.greenhouse.io": "greenhouse",
  "jobs.lever.co": "lever",
  "jobs.eu.lever.co": "lever",
  "jobs.ashbyhq.com": "ashby",
};

/**
 * Detects the ATS system based strictly on exact hostnames:
 * - boards.greenhouse.io, job-boards.greenhouse.io -> greenhouse
 * - jobs.lever.co, jobs.eu.lever.co -> lever
 * - jobs.ashbyhq.com -> ashby
 *
 * Unknown URLs return isSupported: false with a clear reason. Never guesses.
 */
export function detectAtsSystem(url: string): AtsDetectionResult {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    const ats = SUPPORTED_ATS_HOSTNAMES[hostname];
    if (ats) {
      return {
        ats,
        hostname,
        isSupported: true,
      };
    }

    return {
      ats: null,
      hostname,
      isSupported: false,
      reason: `Unsupported ATS URL or unknown job board domain "${hostname}". Qlam only supports official Greenhouse, Lever, and Ashby job boards.`,
    };
  } catch (err) {
    return {
      ats: null,
      hostname: "invalid",
      isSupported: false,
      reason: `Invalid job application URL: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
