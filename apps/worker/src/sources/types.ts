export interface NormalizedJob {
  externalId: string;
  title: string;
  location: string | null;
  isRemote: boolean;
  department: string | null;
  descriptionText: string;
  applyUrl: string;
  postedAt: string | null; // ISO string
  raw: Record<string, unknown>;
}
