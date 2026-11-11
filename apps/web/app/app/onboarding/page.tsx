"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StepProgress } from "@/components/onboarding/step-progress";
import { StepUpload } from "@/components/onboarding/step-upload";
import { StepReview } from "@/components/onboarding/step-review";
import { StepQuestions } from "@/components/onboarding/step-questions";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import {
  type ResumeData,
  type Preferences,
  type CommonAnswersMap,
  COMMON_QUESTIONS,
  QUESTION_KEYS,
} from "@qlam/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Stored state across steps
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [existingResumeCard, setExistingResumeCard] = useState<{
    id: string;
    filePath: string;
    parsed: ResumeData;
  } | null>(null);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, string>>({});
  const [existingPreferences, setExistingPreferences] = useState<Partial<Preferences>>({});

  useEffect(() => {
    async function loadInitialData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/login?next=/app/onboarding");
          return;
        }

        setUserId(user.id);

        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.preferences && typeof profile.preferences === "object") {
          setExistingPreferences(profile.preferences as Partial<Preferences>);
        }

        // Fetch default or latest resume
        const { data: resumes } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);

        if (resumes && resumes.length > 0) {
          const latestResume = resumes[0];
          if (latestResume && latestResume.parsed && typeof latestResume.parsed === "object") {
            const parsed = latestResume.parsed as unknown as ResumeData;
            setResumeId(latestResume.id);
            setResumeData(parsed);
            setExistingResumeCard({
              id: latestResume.id,
              filePath: latestResume.file_path,
              parsed,
            });
          }
        }

        // Fetch answers
        const { data: answersData } = await supabase
          .from("answers")
          .select("question_key, answer")
          .eq("user_id", user.id);

        if (answersData && answersData.length > 0) {
          const ansMap: Record<string, string> = {};
          for (const item of answersData) {
            ansMap[item.question_key] = item.answer;
          }
          setExistingAnswers(ansMap);
        }
      } catch (err) {
        console.error("Failed to load onboarding data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [router, supabase]);

  // Step 1: Upload Complete
  const handleUploadComplete = (data: { resumeId: string; parsed: ResumeData }) => {
    setResumeId(data.resumeId);
    setResumeData(data.parsed);
    setStep(2);
  };

  // Step 2: Save Reviewed Profile
  const handleSaveProfile = async (updated: ResumeData) => {
    if (!userId) return;

    setResumeData(updated);

    // 1. Update parsed resume in database
    if (resumeId) {
      const { error: resumeError } = await supabase
        .from("resumes")
        .update({ parsed: updated })
        .eq("id", resumeId)
        .eq("user_id", userId);

      if (resumeError) {
        throw new Error(`Failed to update resume: ${resumeError.message}`);
      }
    }

    // 2. Prefill profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        name: updated.basics.name || null,
        phone: updated.basics.phone || null,
        city: updated.basics.location?.city || null,
        links: updated.basics.links || [],
      })
      .eq("user_id", userId);

    if (profileError) {
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }
  };

  // Step 3: Save Questions
  const handleSaveQuestions = async (answers: CommonAnswersMap) => {
    if (!userId) return;

    setExistingAnswers(answers);

    // Fetch existing answers to update or insert
    const { data: existingRows } = await supabase
      .from("answers")
      .select("id, question_key")
      .eq("user_id", userId);

    const existingMap = new Map((existingRows || []).map((r) => [r.question_key, r.id]));

    for (const q of COMMON_QUESTIONS) {
      const ansVal = answers[q.key] ?? q.defaultValue ?? "";
      const existingId = existingMap.get(q.key);

      if (existingId) {
        await supabase
          .from("answers")
          .update({
            answer: ansVal,
            question_text: q.questionText,
          })
          .eq("id", existingId);
      } else {
        await supabase.from("answers").insert({
          user_id: userId,
          question_key: q.key,
          question_text: q.questionText,
          answer: ansVal,
          source: "user",
        });
      }
    }

    // Parse notice period into days
    let noticePeriodDays = 0;
    const rawNotice = answers[QUESTION_KEYS.NOTICE_PERIOD] || "";
    if (rawNotice.includes("2 weeks")) noticePeriodDays = 14;
    else if (rawNotice.includes("1 month")) noticePeriodDays = 30;
    else if (rawNotice.includes("2 month")) noticePeriodDays = 60;
    else if (rawNotice.includes("3 month")) noticePeriodDays = 90;
    else if (rawNotice.includes("More than")) noticePeriodDays = 120;

    // Sync to profiles table
    await supabase
      .from("profiles")
      .update({
        work_authorization: answers[QUESTION_KEYS.WORK_AUTHORIZATION] || null,
        needs_sponsorship: answers[QUESTION_KEYS.SPONSORSHIP]?.toLowerCase() === "yes",
        notice_period_days: noticePeriodDays,
        expected_salary: answers[QUESTION_KEYS.EXPECTED_SALARY] || null,
      })
      .eq("user_id", userId);
  };

  // Step 4: Save Preferences and Complete Onboarding
  const handleSavePreferences = async (prefs: Preferences) => {
    if (!userId) return;

    setExistingPreferences(prefs);

    const { error } = await supabase
      .from("profiles")
      .update({
        preferences: prefs,
        onboarding_done: true,
      })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    toast.success("All set! Your profile and preferences are active.");
    router.push("/app/jobs");
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Loading onboarding...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 sm:py-8">
      <div className="text-center space-y-2">
        <div className="inline-flex h-9 w-9 rounded-xl bg-primary items-center justify-center text-primary-foreground font-black text-lg shadow-sm">
          Q
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Welcome to Qlam
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Complete these 4 quick steps to configure your automated job application agent.
        </p>
      </div>

      <StepProgress currentStep={step} />

      {step === 1 && (
        <StepUpload
          existingResume={existingResumeCard}
          onComplete={handleUploadComplete}
        />
      )}

      {step === 2 && resumeData && (
        <StepReview
          initialData={resumeData}
          onSave={handleSaveProfile}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepQuestions
          initialAnswers={existingAnswers}
          onSave={handleSaveQuestions}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <StepPreferences
          initialPreferences={existingPreferences}
          onSave={handleSavePreferences}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}
