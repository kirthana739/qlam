"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMMON_QUESTIONS,
  type CommonAnswersMap,
  CommonAnswersMapSchema,
} from "@qlam/core";
import { Loader2, ArrowLeft, ArrowRight, Save, HelpCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface StepQuestionsProps {
  initialAnswers?: Record<string, string>;
  onSave?: (answers: CommonAnswersMap) => Promise<void>;
  onBack?: () => void;
  onNext?: () => void;
  isProfilePage?: boolean;
}

export function StepQuestions({
  initialAnswers = {},
  onSave,
  onBack,
  onNext,
  isProfilePage = false,
}: StepQuestionsProps) {
  // Initialize with defaults if not present
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const q of COMMON_QUESTIONS) {
      map[q.key] = initialAnswers[q.key] ?? q.defaultValue ?? "";
    }
    return map;
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleFieldChange = (key: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    const validation = CommonAnswersMapSchema.safeParse(answers);
    if (!validation.success) {
      toast.error("Please fill in all required questions.");
      return;
    }

    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(validation.data);
        toast.success("Common questions saved successfully.");
        if (onNext) onNext();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save answers.");
      } finally {
        setIsSaving(false);
      }
    } else if (onNext) {
      onNext();
    }
  };

  const standardQuestions = COMMON_QUESTIONS.filter((q) => !q.isDemographic);
  const demographicQuestions = COMMON_QUESTIONS.filter((q) => q.isDemographic);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">
          {isProfilePage ? "Common Application Questions" : "Common Job Questions"}
        </CardTitle>
        <CardDescription>
          ATS platforms like Greenhouse, Lever, and Ashby ask these questions on almost every
          application. We answer them automatically for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Standard application questions */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" /> Application Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {standardQuestions.map((q) => (
              <div key={q.key} className="space-y-1.5">
                <Label htmlFor={`q-${q.key}`} className="text-xs font-medium">
                  {q.label}
                </Label>

                {q.options && q.options.length > 0 ? (
                  <Select
                    value={answers[q.key] || q.defaultValue || ""}
                    onValueChange={(val) => handleFieldChange(q.key, val)}
                  >
                    <SelectTrigger id={`q-${q.key}`} className="h-9 text-xs">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`q-${q.key}`}
                    className="h-9 text-xs"
                    value={answers[q.key] || ""}
                    placeholder={q.placeholder}
                    onChange={(e) => handleFieldChange(q.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Demographic questions */}
        <div className="space-y-5 border-t border-border pt-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Equal Employment Opportunity
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These voluntary questions are standard for US/global job applications. All default to
              &quot;Decline to self-identify&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demographicQuestions.map((q) => (
              <div key={q.key} className="space-y-1.5">
                <Label htmlFor={`q-${q.key}`} className="text-xs font-medium">
                  {q.label}
                </Label>
                <Select
                  value={answers[q.key] || "Decline to self-identify"}
                  onValueChange={(val) => handleFieldChange(q.key, val)}
                >
                  <SelectTrigger id={`q-${q.key}`} className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(q.options || []).map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
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
                <Save className="h-4 w-4 mr-2" /> Save Answers
              </>
            ) : (
              <>
                Save & Continue <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
