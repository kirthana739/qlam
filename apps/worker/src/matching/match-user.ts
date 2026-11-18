import {
  embed,
  generateJSON,
  MatchScoreResultSchema,
  SCORE_MATCH_SYSTEM_PROMPT,
  buildScoreMatchPrompt,
  type CandidateMatchProfile,
  type MatchedJobRow,
  type ResumeData,
  type Preferences,
} from "@qlam/core";
import { getServiceClient } from "../utils/supabase.js";

const DAILY_SCORING_LIMIT = 50;

export async function runMatchUser(userId: string): Promise<{
  scoredCount: number;
  skipped: boolean;
  reason?: string;
}> {
  const supabase = getServiceClient();

  // 1. Read-only check for daily AI scoring limit
  const { data: currentScoringCount, error: countError } = await supabase.rpc(
    "get_daily_scoring_count",
    { p_user_id: userId }
  );

  if (countError) {
    console.warn(`[match-user] Could not retrieve daily scoring count for ${userId}:`, countError.message);
  }

  const usedToday = typeof currentScoringCount === "number" ? currentScoringCount : 0;
  const remainingQuota = Math.max(0, DAILY_SCORING_LIMIT - usedToday);

  if (remainingQuota <= 0) {
    console.log(`[match-user] User ${userId} reached daily AI scoring limit (${usedToday}/${DAILY_SCORING_LIMIT}).`);
    return { scoredCount: 0, skipped: true, reason: "Daily limit reached" };
  }

  // 2. Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    console.warn(`[match-user] Profile not found for user ${userId}.`);
    return { scoredCount: 0, skipped: true, reason: "Profile not found" };
  }

  // 3. Fetch latest/default resume
  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const defaultResume = resumes?.[0];
  const parsedResume = (defaultResume?.parsed as unknown as ResumeData) || null;

  // 4. Extract preferences and skills
  const prefs = (profile.preferences || {}) as Partial<Preferences>;
  const targetRoles = Array.isArray(prefs.roles) ? prefs.roles : [];

  const skillsList: string[] = [];
  if (parsedResume?.skills && Array.isArray(parsedResume.skills)) {
    for (const skill of parsedResume.skills) {
      if (skill.name) {
        skillsList.push(skill.name);
      }
      if (Array.isArray(skill.keywords)) {
        skillsList.push(...skill.keywords);
      }
    }
  }

  const recentExperiences = parsedResume?.experience || [];
  const recentTitles = recentExperiences
    .slice(0, 3)
    .map((e) => `${e.position} at ${e.company}`)
    .filter(Boolean);

  const summary = parsedResume?.summary || "";

  if (targetRoles.length === 0 && skillsList.length === 0 && !summary) {
    console.log(`[match-user] Profile incomplete for user ${userId}. Skipping matching.`);
    return { scoredCount: 0, skipped: true, reason: "Incomplete profile" };
  }

  // 5. Generate or verify embedding
  let candidateVector: number[] | null = null;
  if (!profile.embedding) {
    const embeddingTextParts: string[] = [];
    if (targetRoles.length > 0) {
      embeddingTextParts.push(`Target Roles: ${targetRoles.join(", ")}`);
    }
    if (skillsList.length > 0) {
      embeddingTextParts.push(`Skills: ${Array.from(new Set(skillsList)).slice(0, 30).join(", ")}`);
    }
    if (recentTitles.length > 0) {
      embeddingTextParts.push(`Recent Job Titles: ${recentTitles.join(", ")}`);
    }
    if (summary) {
      embeddingTextParts.push(`Professional Summary: ${summary}`);
    }

    const candidateEmbeddingText = embeddingTextParts.join("\n\n");
    const [vector] = await embed([candidateEmbeddingText]);
    if (vector && vector.length === 768) {
      candidateVector = vector;
      await supabase
        .from("profiles")
        .update({ embedding: JSON.stringify(candidateVector) })
        .eq("user_id", userId);
    }
  }

  // 6. Find open jobs closest to profile embedding via match_jobs RPC
  const { data: matchedJobs, error: matchRpcError } = await supabase.rpc("match_jobs", {
    p_user_id: userId,
    p_limit: 30,
  });

  if (matchRpcError) {
    console.error(`[match-user] match_jobs RPC error for user ${userId}:`, matchRpcError.message);
    return { scoredCount: 0, skipped: true, reason: matchRpcError.message };
  }

  if (!matchedJobs || matchedJobs.length === 0) {
    console.log(`[match-user] No matching candidate jobs found for user ${userId}.`);
    // Stamp last_matched_at so we don't immediately retry
    await supabase
      .from("profiles")
      .update({ last_matched_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { scoredCount: 0, skipped: false };
  }

  // 7. Filter out already-scored jobs
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("job_id")
    .eq("user_id", userId);

  const existingJobIds = new Set((existingMatches || []).map((m: { job_id: string }) => m.job_id));
  const candidateList = (matchedJobs as MatchedJobRow[] | null) || [];
  const unscoredJobs = candidateList.filter((job: MatchedJobRow) => !existingJobIds.has(job.id));
  const batchLimit = Math.min(remainingQuota, 10);
  const jobsToScore = unscoredJobs.slice(0, batchLimit);

  if (jobsToScore.length === 0) {
    console.log(`[match-user] All candidate jobs are already scored for user ${userId}.`);
    await supabase
      .from("profiles")
      .update({ last_matched_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { scoredCount: 0, skipped: false };
  }

  // 8. Prepare candidate profile for scoring
  const candidateProfile: CandidateMatchProfile = {
    name: profile.name || parsedResume?.basics?.name || undefined,
    targetRoles,
    skills: Array.from(new Set(skillsList)),
    experience: recentExperiences.map((e) => ({
      position: e.position,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
    summary: summary || undefined,
    location: profile.city || parsedResume?.basics?.location?.city || undefined,
    workAuthorization: profile.work_authorization,
    needsSponsorship: profile.needs_sponsorship,
  };

  // 9. Score jobs
  let scoredCount = 0;
  for (let i = 0; i < jobsToScore.length; i++) {
    const job = jobsToScore[i];
    if (!job) continue;

    try {
      const prompt = buildScoreMatchPrompt(candidateProfile, {
        title: job.title,
        companyName: job.company_name,
        location: job.location,
        isRemote: job.is_remote,
        department: job.department,
        descriptionText: job.description_text,
      });

      const scoreResult = await generateJSON({
        system: SCORE_MATCH_SYSTEM_PROMPT,
        prompt,
        schema: MatchScoreResultSchema,
      });

      let finalScore = Math.max(0, Math.min(100, Math.round(scoreResult.score)));
      if (
        scoreResult.dealbreakers &&
        scoreResult.dealbreakers.length > 0 &&
        finalScore > 30
      ) {
        finalScore = 30;
      }

      const { error: upsertError } = await supabase.from("matches").upsert(
        {
          user_id: userId,
          job_id: job.id,
          score: finalScore,
          reasons: {
            fits: scoreResult.fits,
            gaps: scoreResult.gaps,
            dealbreakers: scoreResult.dealbreakers,
          },
          status: "new",
        },
        { onConflict: "user_id,job_id" }
      );

      if (!upsertError) {
        scoredCount++;
        // Increment daily scoring count atomically only on successful score
        await supabase.rpc("increment_daily_scoring", {
          p_user_id: userId,
          p_increment: 1,
        });
      }
    } catch (err) {
      console.error(`[match-user] Failed to score job ${job.id} for user ${userId}:`, err);
    }

    if (i < jobsToScore.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // 10. Update last_matched_at timestamp
  await supabase
    .from("profiles")
    .update({ last_matched_at: new Date().toISOString() })
    .eq("user_id", userId);

  console.log(`[match-user] Finished scoring ${scoredCount} jobs for user ${userId}.`);
  return { scoredCount, skipped: false };
}
