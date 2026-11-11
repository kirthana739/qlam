"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicsForm } from "@/components/profile/basics-form";
import { ExperienceForm } from "@/components/profile/experience-form";
import { EducationSkillsForm } from "@/components/profile/education-skills-form";
import {
  type ResumeData,
  ResumeDataSchema,
} from "@qlam/core";
import { Loader2, ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import { toast } from "sonner";

interface StepReviewProps {
  initialData: ResumeData;
  onSave?: (data: ResumeData) => Promise<void>;
  onBack?: () => void;
  onNext?: () => void;
  isProfilePage?: boolean;
}

export function StepReview({
  initialData,
  onSave,
  onBack,
  onNext,
  isProfilePage = false,
}: StepReviewProps) {
  const [data, setData] = useState<ResumeData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");

  const handleSave = async () => {
    // 1. Zod validation
    const validation = ResumeDataSchema.safeParse(data);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Validation failed";
      toast.error(`Please review profile details: ${message}`);
      return;
    }

    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(validation.data);
        toast.success("Profile details saved successfully.");
        if (onNext) onNext();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save profile.");
      } finally {
        setIsSaving(false);
      }
    } else if (onNext) {
      onNext();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">
          {isProfilePage ? "Resume & Profile Details" : "Review Parsed Profile"}
        </CardTitle>
        <CardDescription>
          {isProfilePage
            ? "Manage and edit your parsed resume information."
            : "Review and refine your parsed resume data. Every field is editable and will be used to tailor your job applications."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basics" className="text-xs sm:text-sm">
              Personal & Summary
            </TabsTrigger>
            <TabsTrigger value="experience" className="text-xs sm:text-sm">
              Work Experience ({data.experience?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="education" className="text-xs sm:text-sm">
              Education & Skills
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="pt-4">
            <BasicsForm
              basics={data.basics}
              summary={data.summary}
              onChangeBasics={(updatedBasics) => setData({ ...data, basics: updatedBasics })}
              onChangeSummary={(updatedSummary) => setData({ ...data, summary: updatedSummary })}
            />
          </TabsContent>

          <TabsContent value="experience" className="pt-4">
            <ExperienceForm
              experience={data.experience || []}
              onChangeExperience={(updatedExp) => setData({ ...data, experience: updatedExp })}
            />
          </TabsContent>

          <TabsContent value="education" className="pt-4">
            <EducationSkillsForm
              education={data.education || []}
              skills={data.skills || []}
              projects={data.projects || []}
              certifications={data.certifications || []}
              onChangeEducation={(items) => setData({ ...data, education: items })}
              onChangeSkills={(items) => setData({ ...data, skills: items })}
              onChangeProjects={(items) => setData({ ...data, projects: items })}
              onChangeCertifications={(items) => setData({ ...data, certifications: items })}
            />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          {onBack ? (
            <Button variant="outline" size="sm" onClick={onBack} disabled={isSaving}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          ) : (
            <div />
          )}

          <Button onClick={handleSave} disabled={isSaving} size="sm" className="min-w-[140px]">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : isProfilePage ? (
              <>
                <Save className="h-4 w-4 mr-2" /> Save Profile
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" /> Save & Continue <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
