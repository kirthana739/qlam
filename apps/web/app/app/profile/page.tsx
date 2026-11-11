"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepReview } from "@/components/onboarding/step-review";
import { StepQuestions } from "@/components/onboarding/step-questions";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepUpload } from "@/components/onboarding/step-upload";
import {
  type ResumeData,
  type Preferences,
  type CommonAnswersMap,
  COMMON_QUESTIONS,
  QUESTION_KEYS,
} from "@qlam/core";
import { Loader2, User, FileText, HelpCircle, Sliders, UploadCloud } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeFilePath, setResumeFilePath] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<Partial<Preferences>>({});
  const [userEmail, setUserEmail] = useState<string>("");
  const [activeTab, setActiveTab] = useState("profile");

  const loadProfileData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);
      setUserEmail(user.email || "");

      // 1. Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.preferences && typeof profile.preferences === "object") {
        setPreferences(profile.preferences as Partial<Preferences>);
      }

      // 2. Fetch default resume
      const { data: resumes } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (resumes && resumes.length > 0) {
        const defaultResume = resumes[0];
        if (defaultResume) {
          setResumeId(defaultResume.id);
          setResumeFilePath(defaultResume.file_path);
          if (defaultResume.parsed && typeof defaultResume.parsed === "object") {
            setResumeData(defaultResume.parsed as unknown as ResumeData);
          }
        }
      }

      // 3. Fetch answers
      const { data: answersData } = await supabase
        .from("answers")
        .select("question_key, answer")
        .eq("user_id", user.id);

      if (answersData && answersData.length > 0) {
        const map: Record<string, string> = {};
        for (const item of answersData) {
          map[item.question_key] = item.answer;
        }
        setAnswers(map);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast.error("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleSaveProfile = async (updated: ResumeData) => {
    if (!userId) return;

    setResumeData(updated);

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

  const handleSaveQuestions = async (updatedAnswers: CommonAnswersMap) => {
    if (!userId) return;

    setAnswers(updatedAnswers);

    const { data: existingRows } = await supabase
      .from("answers")
      .select("id, question_key")
      .eq("user_id", userId);

    const existingMap = new Map((existingRows || []).map((r) => [r.question_key, r.id]));

    for (const q of COMMON_QUESTIONS) {
      const ansVal = updatedAnswers[q.key] ?? q.defaultValue ?? "";
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

    let noticePeriodDays = 0;
    const rawNotice = updatedAnswers[QUESTION_KEYS.NOTICE_PERIOD] || "";
    if (rawNotice.includes("2 weeks")) noticePeriodDays = 14;
    else if (rawNotice.includes("1 month")) noticePeriodDays = 30;
    else if (rawNotice.includes("2 month")) noticePeriodDays = 60;
    else if (rawNotice.includes("3 month")) noticePeriodDays = 90;
    else if (rawNotice.includes("More than")) noticePeriodDays = 120;

    await supabase
      .from("profiles")
      .update({
        work_authorization: updatedAnswers[QUESTION_KEYS.WORK_AUTHORIZATION] || null,
        needs_sponsorship: updatedAnswers[QUESTION_KEYS.SPONSORSHIP]?.toLowerCase() === "yes",
        notice_period_days: noticePeriodDays,
        expected_salary: updatedAnswers[QUESTION_KEYS.EXPECTED_SALARY] || null,
      })
      .eq("user_id", userId);
  };

  const handleSavePreferences = async (updatedPrefs: Preferences) => {
    if (!userId) return;

    setPreferences(updatedPrefs);

    const { error } = await supabase
      .from("profiles")
      .update({
        preferences: updatedPrefs,
      })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }
  };

  const handleNewResumeUploaded = (data: { resumeId: string; parsed: ResumeData }) => {
    setResumeId(data.resumeId);
    setResumeData(data.parsed);
    toast.success("New resume uploaded and parsed successfully!");
    setActiveTab("profile");
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-6 w-6 text-primary" /> Profile & Application Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Signed in as {userEmail}. Review and edit your resume data, answers, and job preferences.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="profile" className="text-xs flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Resume Details
          </TabsTrigger>
          <TabsTrigger value="questions" className="text-xs flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" /> Common Answers
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Job Preferences
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs flex items-center gap-1.5">
            <UploadCloud className="h-3.5 w-3.5" /> Upload New Resume
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          {resumeData ? (
            <StepReview
              initialData={resumeData}
              onSave={handleSaveProfile}
              isProfilePage={true}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No parsed resume found.</p>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="text-xs text-primary underline"
              >
                Upload your resume now
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="questions">
          <StepQuestions
            initialAnswers={answers}
            onSave={handleSaveQuestions}
            isProfilePage={true}
          />
        </TabsContent>

        <TabsContent value="preferences">
          <StepPreferences
            initialPreferences={preferences}
            onSave={handleSavePreferences}
            isProfilePage={true}
          />
        </TabsContent>

        <TabsContent value="upload">
          <StepUpload
            existingResume={
              resumeData && resumeId && resumeFilePath
                ? { id: resumeId, filePath: resumeFilePath, parsed: resumeData }
                : null
            }
            onComplete={handleNewResumeUploaded}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
