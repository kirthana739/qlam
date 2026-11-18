"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, HelpCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestionToAsk } from "@qlam/core";

export interface ApplicationNeedingUser {
  id: string;
  job_id: string;
  run_status: string;
  needs_user_reason: string | null;
  job?: {
    title: string;
    company_name?: string;
    company?: {
      name: string;
    };
  } | null;
}

interface NeedsUserBannerProps {
  applications: ApplicationNeedingUser[];
  onApplicationUpdated: () => void;
}

export function parseQuestionsFromReason(reason?: string | null): QuestionToAsk[] {
  if (!reason) return [];

  const raw = reason.trim();
  // Strip optional prefix e.g. "Missing required questions: "
  const prefix = "Missing required questions:";
  const clean = raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;

  if (clean.startsWith("[") && clean.endsWith("]")) {
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          key: item.key || item.text.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          text: item.text || item.label || "Custom Question",
          type: item.type || "text",
          options: item.options || undefined,
          required: item.required ?? true,
          selector: item.selector,
        }));
      }
    } catch {
      // Fallback to text parsing
    }
  }

  // Fallback: parse semicolon or comma separated questions
  return clean
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((q) => ({
      key: q.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      text: q,
      type: "text",
      required: true,
    }));
}

export function NeedsUserBanner({
  applications,
  onApplicationUpdated,
}: NeedsUserBannerProps) {
  const [answersByApp, setAnswersByApp] = useState<Record<string, Record<string, string>>>({});
  const [submittingAppId, setSubmittingAppId] = useState<string | null>(null);

  if (applications.length === 0) return null;

  const handleInputChange = (appId: string, questionKey: string, value: string) => {
    setAnswersByApp((prev) => ({
      ...prev,
      [appId]: {
        ...(prev[appId] || {}),
        [questionKey]: value,
      },
    }));
  };

  const handleSubmit = async (app: ApplicationNeedingUser, questions: QuestionToAsk[]) => {
    const currentAnswers = answersByApp[app.id] || {};

    // Validate that required questions have answers
    const payloadAnswers: Array<{ question_key: string; question_text: string; answer: string }> = [];
    for (const q of questions) {
      const ans = (currentAnswers[q.key] || "").trim();
      if (!ans && q.required) {
        toast.error(`Please provide an answer for: "${q.text}"`);
        return;
      }
      if (ans) {
        payloadAnswers.push({
          question_key: q.key,
          question_text: q.text,
          answer: ans,
        });
      }
    }

    if (payloadAnswers.length === 0) {
      toast.error("Please answer at least one question.");
      return;
    }

    setSubmittingAppId(app.id);
    try {
      const res = await fetch("/api/applications/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.id,
          answers: payloadAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit answers");
      }

      toast.success("Answers saved to your bank! Application re-queued.");
      onApplicationUpdated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmittingAppId(null);
    }
  };

  return (
    <div className="space-y-4">
      {applications.map((app) => {
        const questions = parseQuestionsFromReason(app.needs_user_reason);
        const companyName =
          app.job?.company?.name || app.job?.company_name || "Company";
        const jobTitle = app.job?.title || "Position";
        const isSubmitting = submittingAppId === app.id;

        return (
          <Card
            key={app.id}
            className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Action Needed: {jobTitle} at {companyName}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                The employer requires additional custom information to complete your application.
                Your answers will be saved to your Answers Bank so you won&apos;t be asked again.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {questions.map((q) => {
                  const currentValue = answersByApp[app.id]?.[q.key] || "";

                  return (
                    <div
                      key={q.key}
                      className="space-y-1.5 p-3 rounded-md bg-background/80 border border-border/60"
                    >
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        <span>{q.text}</span>
                        {q.required && <span className="text-destructive">*</span>}
                      </Label>

                      {q.options && q.options.length > 0 ? (
                        <Select
                          value={currentValue}
                          onValueChange={(val) => handleInputChange(app.id, q.key, val)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select an option..." />
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
                          placeholder="Your answer..."
                          value={currentValue}
                          onChange={(e) =>
                            handleInputChange(app.id, q.key, e.target.value)
                          }
                          className="h-9 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={() => handleSubmit(app, questions)}
                  disabled={isSubmitting}
                  className="gap-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  <span>Save Answers & Re-queue</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
