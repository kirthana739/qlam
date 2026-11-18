"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ResumeData } from "@qlam/core";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface EditResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: ResumeData;
  onSave: (updated: ResumeData) => Promise<void>;
}

export function EditResumeDialog({
  open,
  onOpenChange,
  resume,
  onSave,
}: EditResumeDialogProps) {
  const [summary, setSummary] = useState(resume.summary || "");
  const [experience, setExperience] = useState(resume.experience || []);
  const [skills, setSkills] = useState(resume.skills || []);
  const [saving, setSaving] = useState(false);

  const handleHighlightChange = (expIndex: number, hIndex: number, value: string) => {
    const nextExp = [...experience];
    const target = nextExp[expIndex];
    if (!target) return;
    const nextHighlights = [...(target.highlights || [])];
    nextHighlights[hIndex] = value;
    target.highlights = nextHighlights;
    setExperience(nextExp);
  };

  const handleAddHighlight = (expIndex: number) => {
    const nextExp = [...experience];
    const target = nextExp[expIndex];
    if (!target) return;
    target.highlights = [...(target.highlights || []), ""];
    setExperience(nextExp);
  };

  const handleRemoveHighlight = (expIndex: number, hIndex: number) => {
    const nextExp = [...experience];
    const target = nextExp[expIndex];
    if (!target) return;
    target.highlights = (target.highlights || []).filter((_, idx) => idx !== hIndex);
    setExperience(nextExp);
  };

  const handleSkillKeywordsChange = (sIndex: number, value: string) => {
    const nextSkills = [...skills];
    const target = nextSkills[sIndex];
    if (!target) return;
    target.keywords = value.split(",").map((k) => k.trim()).filter(Boolean);
    setSkills(nextSkills);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: ResumeData = {
        ...resume,
        summary,
        experience,
        skills,
      };
      await onSave(updated);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tailored Resume</DialogTitle>
          <DialogDescription>
            Manually refine bullet points, summary, and skills for this application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Summary */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Professional Summary</Label>
            <Textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary statement..."
              className="text-xs"
            />
          </div>

          {/* Experience bullets */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold">Experience Highlights</Label>
            {experience.map((exp, expIdx) => (
              <div key={expIdx} className="rounded-lg border border-border p-3 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span>{exp.position} at {exp.company}</span>
                  <span className="text-muted-foreground">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                </div>
                <div className="space-y-2">
                  {(exp.highlights || []).map((bullet, hIdx) => (
                    <div key={hIdx} className="flex gap-2 items-start">
                      <Input
                        value={bullet}
                        onChange={(e) => handleHighlightChange(expIdx, hIdx, e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveHighlight(expIdx, hIdx)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddHighlight(expIdx)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Highlight
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Skills Categories (comma separated)</Label>
            {skills.map((skill, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{skill.name}</span>
                <Input
                  value={(skill.keywords || []).join(", ")}
                  onChange={(e) => handleSkillKeywordsChange(sIdx, e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. React, Next.js, TypeScript"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
