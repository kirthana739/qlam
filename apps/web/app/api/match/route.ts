import { NextResponse, type NextRequest } from "next/server";
import {
  embed,
  generateJSON,
  AI_BUSY_MESSAGE,
  MatchScoreResultSchema,
  SCORE_MATCH_SYSTEM_PROMPT,
  buildScoreMatchPrompt,
  type CandidateMatchProfile,
  type MatchedJobRow,
  type ResumeData,
  type Preferences,
} from "@qlam/core";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request: NextRequest) {
  // 1. Verify authenticated user session
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Fetch latest/default resume
    const { data: resumes } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    const defaultResume = resumes?.[0];
    const parsedResume = (defaultResume?.parsed as unknown as ResumeData) || null;

    // 4. Extract preferences and resume details
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
      return NextResponse.json(
        {
          error:
            "Profile incomplete. Please add target roles in preferences or upload a resume before matching jobs.",
        },
        { status: 400 }
      );
    }

    // 5. Build candidate embedding text and generate 768-dim vector
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
    const [candidateVector] = await embed([candidateEmbeddingText]);

    if (!candidateVector || candidateVector.length !== 768) {
      return NextResponse.json(
        { error: "Failed to generate valid 768-dimensional embedding." },
        { status: 500 }
      );
    }

    // 6. Save embedding to profiles.embedding
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ embedding: JSON.stringify(candidateVector) })
      .eq("user_id", user.id);

    if (updateProfileError) {
      return NextResponse.json(
        { error: `Failed to save profile embedding: ${updateProfileError.message}` },
        { status: 500 }
      );
    }

    // 7. Call match_jobs RPC to retrieve up to 30 closest jobs by cosine similarity
    const { data: matchedJobs, error: matchRpcError } = await supabase.rpc("match_jobs", {
      p_user_id: user.id,
      p_limit: 30,
    });

    if (matchRpcError) {
      return NextResponse.json(
        { error: `Matching engine error: ${matchRpcError.message}` },
        { status: 500 }
      );
    }

    if (!matchedJobs || matchedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No open matching jobs found at this time.",
        scoredCount: 0,
      });
    }

    // 8. Check daily AI scoring usage limit (max 50 scoring calls per user per day)
    const DAILY_SCORING_LIMIT = 50;
    const { data: currentScoringCount, error: countError } = await supabase.rpc(
      "get_daily_scoring_count",
      { p_user_id: user.id }
    );

    if (countError) {
      console.warn("Could not retrieve daily scoring count:", countError.message);
    }

    const usedToday = typeof currentScoringCount === "number" ? currentScoringCount : 0;
    const remainingQuota = Math.max(0, DAILY_SCORING_LIMIT - usedToday);

    if (remainingQuota <= 0) {
      return NextResponse.json(
        {
          error: "Daily AI scoring limit reached (50/50). Try again tomorrow.",
          limitReached: true,
          scoredCount: 0,
        },
        { status: 429 }
      );
    }

    // 9. Filter out already-scored jobs BEFORE taking the top N (max min(remainingQuota, 10) jobs)
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("job_id")
      .eq("user_id", user.id);

    const existingJobIds = new Set((existingMatches || []).map((m: { job_id: string }) => m.job_id));
    const candidateList = (matchedJobs as MatchedJobRow[] | null) || [];
    const unscoredJobs = candidateList.filter((job: MatchedJobRow) => !existingJobIds.has(job.id));
    const batchLimit = Math.min(remainingQuota, 10);
    const jobsToScore = unscoredJobs.slice(0, batchLimit);

    if (jobsToScore.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All candidate jobs are already scored.",
        scoredCount: 0,
      });
    }

    // 10. Prepare candidate profile object for scoring
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

    // 11. Score jobs sequentially with 45s time budget and 1-second pause
    const startTime = Date.now();
    const MAX_ELAPSED_MS = 45000;
    let scoredCount = 0;

    for (let i = 0; i < jobsToScore.length; i++) {
      // Enforce 45s time budget to avoid function timeout and return partial results
      if (Date.now() - startTime >= MAX_ELAPSED_MS) {
        console.log(`Scoring time budget reached (${MAX_ELAPSED_MS}ms). Returning partial results.`);
        break;
      }

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

        // Enforce dealbreaker score cap at 30
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
            user_id: user.id,
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
          // Increment daily scoring count only after successful score
          await supabase.rpc("increment_daily_scoring", {
            p_user_id: user.id,
            p_increment: 1,
          });
        }
      } catch (err) {
        // Skip failed AI call and do NOT increment daily scoring usage
        console.error(`Failed to score job ${job.id}:`, err);
      }

      // 1-second pause between AI scoring calls to respect rate limits
      if (i < jobsToScore.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      scoredCount,
      remainingUnscored: Math.max(0, unscoredJobs.length - scoredCount),
      dailyScoringUsed: usedToday + scoredCount,
      dailyScoringLimit: DAILY_SCORING_LIMIT,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to run matching engine";
    const isBusy =
      rawMessage === AI_BUSY_MESSAGE ||
      rawMessage.toLowerCase().includes("ai is busy") ||
      rawMessage.includes("503") ||
      rawMessage.includes("429");
    const message = isBusy ? "AI is busy, try again" : rawMessage;
    const status = isBusy ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
