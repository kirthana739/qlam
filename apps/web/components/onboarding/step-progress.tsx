"use client";

import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number; // 1, 2, 3, 4
  totalSteps?: number;
}

const STEPS = [
  { id: 1, name: "Upload Resume", short: "Resume" },
  { id: 2, name: "Review Profile", short: "Profile" },
  { id: 3, name: "Common Questions", short: "Questions" },
  { id: 4, name: "Preferences", short: "Preferences" },
];

export function StepProgress({ currentStep, totalSteps = 4 }: StepProgressProps) {
  const percent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-muted-foreground">
        <span>
          Step {currentStep} of {totalSteps}: {STEPS[currentStep - 1]?.name}
        </span>
        <span className="font-semibold text-foreground">{percent}%</span>
      </div>

      <Progress value={percent} className="h-2" />

      <div className="grid grid-cols-4 gap-2 pt-1">
        {STEPS.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                isCurrent && "font-semibold text-primary",
                isCompleted && "text-muted-foreground",
                !isCurrent && !isCompleted && "text-muted-foreground/50"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary text-primary font-bold",
                  !isCurrent && !isCompleted && "border border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : step.id}
              </div>
              <span className="hidden sm:inline truncate">{step.name}</span>
              <span className="sm:hidden truncate">{step.short}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
