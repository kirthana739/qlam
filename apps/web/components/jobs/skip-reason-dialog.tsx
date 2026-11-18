"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const SKIP_PRESETS = [
  "Not my role",
  "Too senior",
  "Location",
  "Company",
] as const;

interface SkipReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  companyName: string;
  isSubmitting?: boolean;
  onConfirmSkip: (reason?: string) => Promise<void> | void;
}

export function SkipReasonDialog({
  open,
  onOpenChange,
  jobTitle,
  companyName,
  isSubmitting = false,
  onConfirmSkip,
}: SkipReasonDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  const handlePresetClick = (preset: string) => {
    setSelectedPreset((prev) => (prev === preset ? null : preset));
  };

  const handleConfirm = async () => {
    const parts: string[] = [];
    if (selectedPreset) {
      parts.push(selectedPreset);
    }
    if (customReason.trim()) {
      parts.push(customReason.trim());
    }

    const finalReason = parts.length > 0 ? parts.join(": ") : undefined;
    await onConfirmSkip(finalReason);

    // Reset state after skip
    setSelectedPreset(null);
    setCustomReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Skip this job recommendation?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {jobTitle} at <span className="font-medium text-foreground">{companyName}</span> will be removed from your active feed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preset Chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Reason (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {SKIP_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free text input */}
          <div className="space-y-1.5">
            <Label htmlFor="skip-custom-reason" className="text-xs font-medium text-muted-foreground">
              Additional notes (optional)
            </Label>
            <Textarea
              id="skip-custom-reason"
              placeholder="e.g. Prefer earlier-stage startup, requires 5 days on-site..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="h-20 text-xs resize-none"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="text-xs h-8 gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Skipping...</span>
              </>
            ) : (
              <span>Skip Job</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
