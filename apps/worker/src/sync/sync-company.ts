import { embed, type AtsType, type Json } from "@qlam/core";
import { getServiceClient } from "../utils/supabase.js";
import {
  fetchGreenhouseJobs,
  fetchGreenhouseJobQuestions,
  fetchLeverJobs,
  fetchAshbyJobs,
  type NormalizedJob,
} from "../sources/index.js";

const EMBED_BATCH_SIZE = 50;
const UPSERT_CHUNK_SIZE = 50;

interface ExistingJobRow {
  external_id: string;
  title: string;
  location: string | null;
  description_text: string | null;
  embedding: string | null;
  is_open: boolean;
}

export async function syncCompany(companyId: string): Promise<{
  totalSynced: number;
  newOrUpdated: number;
  closed: number;
}> {
  const supabase = getServiceClient();

  // 1. Fetch company
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    throw new Error(
      `Company not found: ${companyId} (${companyError?.message || "unknown"})`
    );
  }

  if (!company.active) {
    return { totalSynced: 0, newOrUpdated: 0, closed: 0 };
  }

  // 2. Fetch jobs from corresponding ATS adapter
  let incomingJobs: NormalizedJob[] = [];
  const ats = company.ats as AtsType;

  if (ats === "greenhouse") {
    incomingJobs = await fetchGreenhouseJobs(company.board_token);
  } else if (ats === "lever") {
    incomingJobs = await fetchLeverJobs(company.board_token);
  } else if (ats === "ashby") {
    incomingJobs = await fetchAshbyJobs(company.board_token);
  } else {
    throw new Error(`Unsupported ATS type: ${company.ats}`);
  }

  // 3. Query existing jobs for this company
  const { data: existingRows, error: existingError } = await supabase
    .from("jobs")
    .select("external_id, title, location, description_text, embedding, is_open")
    .eq("company_id", company.id);

  if (existingError) {
    throw new Error(`Failed to query existing jobs: ${existingError.message}`);
  }

  const existingMap = new Map<string, ExistingJobRow>();
  for (const row of existingRows || []) {
    existingMap.set(row.external_id, row);
  }

  // 4. Identify new and changed jobs
  const jobsToEmbed: NormalizedJob[] = [];
  const jobEmbeddingsMap = new Map<string, string>(); // externalId -> vector string

  for (const job of incomingJobs) {
    const existing = existingMap.get(job.externalId);
    const isNew = !existing;
    const isChanged =
      !isNew &&
      (existing.title !== job.title ||
        existing.location !== job.location ||
        existing.description_text !== job.descriptionText ||
        !existing.embedding);

    if (isNew || isChanged) {
      jobsToEmbed.push(job);

      // Greenhouse: also fetch questions for newly discovered jobs
      if (ats === "greenhouse" && isNew) {
        try {
          const questions = await fetchGreenhouseJobQuestions(
            company.board_token,
            job.externalId
          );
          job.raw.questions = questions;
        } catch (err) {
          console.warn(
            `Failed to fetch Greenhouse questions for job ${job.externalId}:`,
            err
          );
        }
      }
    }
  }

  // 5. Generate embeddings in batches of 50
  for (let i = 0; i < jobsToEmbed.length; i += EMBED_BATCH_SIZE) {
    const chunk = jobsToEmbed.slice(i, i + EMBED_BATCH_SIZE);
    const texts = chunk.map(
      (job) =>
        `${job.title} | ${job.location || ""} | ${job.descriptionText.slice(0, 2000)}`
    );

    try {
      const vectors = await embed(texts);
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const vector = vectors[j];
        if (item && vector) {
          jobEmbeddingsMap.set(item.externalId, JSON.stringify(vector));
        }
      }
    } catch (embedError) {
      console.error(
        `Failed to generate embeddings batch (${i}-${i + chunk.length}):`,
        embedError
      );
      // Continue sync even if embedding fails for this batch
    }
  }

  // 6. Upsert active jobs into database in chunks
  const nowISO = new Date().toISOString();

  for (let i = 0; i < incomingJobs.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = incomingJobs.slice(i, i + UPSERT_CHUNK_SIZE);
    const upsertRows = chunk.map((job) => {
      const embeddingStr = jobEmbeddingsMap.get(job.externalId);
      const existing = existingMap.get(job.externalId);

      return {
        company_id: company.id,
        ats: company.ats,
        external_id: job.externalId,
        title: job.title,
        location: job.location,
        is_remote: job.isRemote,
        department: job.department,
        description_text: job.descriptionText,
        apply_url: job.applyUrl,
        posted_at: job.postedAt,
        is_open: true,
        last_seen_at: nowISO,
        raw: job.raw as Json,
        ...(embeddingStr
          ? { embedding: embeddingStr }
          : existing?.embedding
            ? { embedding: existing.embedding }
            : {}),
      };
    });

    const { error: upsertError } = await supabase
      .from("jobs")
      .upsert(upsertRows, { onConflict: "ats, external_id" });

    if (upsertError) {
      throw new Error(`Failed to upsert jobs chunk: ${upsertError.message}`);
    }
  }

  // 7. Mark missing jobs as is_open = false
  const incomingExternalIds = new Set(incomingJobs.map((j) => j.externalId));
  const missingExternalIds: string[] = [];

  for (const [extId, row] of existingMap.entries()) {
    if (!incomingExternalIds.has(extId) && row.is_open) {
      missingExternalIds.push(extId);
    }
  }

  if (missingExternalIds.length > 0) {
    // Update in chunks
    for (let i = 0; i < missingExternalIds.length; i += 100) {
      const chunk = missingExternalIds.slice(i, i + 100);
      const { error: closeError } = await supabase
        .from("jobs")
        .update({ is_open: false })
        .eq("company_id", company.id)
        .in("external_id", chunk);

      if (closeError) {
        console.error("Failed to mark missing jobs as closed:", closeError);
      }
    }
  }

  // 8. Update companies.last_synced_at
  await supabase
    .from("companies")
    .update({ last_synced_at: nowISO })
    .eq("id", company.id);

  return {
    totalSynced: incomingJobs.length,
    newOrUpdated: jobsToEmbed.length,
    closed: missingExternalIds.length,
  };
}
