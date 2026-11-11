"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  type Preferences,
  type SeniorityLevel,
  PreferencesSchema,
} from "@qlam/core";
import { Loader2, ArrowLeft, Check, Save, Plus, X, Sparkles, Sliders } from "lucide-react";
import { toast } from "sonner";

interface StepPreferencesProps {
  initialPreferences?: Partial<Preferences>;
  onSave?: (prefs: Preferences) => Promise<void>;
  onBack?: () => void;
  onComplete?: () => void;
  isProfilePage?: boolean;
}

const SENIORITY_OPTIONS: { id: SeniorityLevel; label: string }[] = [
  { id: "intern", label: "Intern" },
  { id: "entry", label: "Entry Level" },
  { id: "mid", label: "Mid Level" },
  { id: "senior", label: "Senior" },
];

const JOB_TYPE_OPTIONS = [
  { id: "full-time", label: "Full-time" },
  { id: "contract", label: "Contract" },
  { id: "part-time", label: "Part-time" },
  { id: "internship", label: "Internship" },
];

export function StepPreferences({
  initialPreferences = {},
  onSave,
  onBack,
  onComplete,
  isProfilePage = false,
}: StepPreferencesProps) {
  const [roles, setRoles] = useState<string[]>(initialPreferences.roles || []);
  const [roleInput, setRoleInput] = useState("");

  const [locations, setLocations] = useState<string[]>(initialPreferences.locations || []);
  const [locationInput, setLocationInput] = useState("");

  const [remote, setRemote] = useState(initialPreferences.remote ?? true);

  const [seniority, setSeniority] = useState<SeniorityLevel[]>(
    initialPreferences.seniority || ["mid", "senior"]
  );

  const [jobTypes, setJobTypes] = useState<string[]>(
    initialPreferences.job_types || ["full-time"]
  );

  const [avoidCompanies, setAvoidCompanies] = useState<string[]>(
    initialPreferences.companies_to_avoid || initialPreferences.excluded_companies || []
  );
  const [avoidInput, setAvoidInput] = useState("");

  const [minMatchScore, setMinMatchScore] = useState<number>(
    initialPreferences.min_match_score ?? 70
  );

  const [isSaving, setIsSaving] = useState(false);

  // Tag list helpers
  const handleAddRole = () => {
    const trimmed = roleInput.trim();
    if (trimmed && !roles.includes(trimmed)) {
      setRoles([...roles, trimmed]);
      setRoleInput("");
    }
  };

  const handleAddLocation = () => {
    const trimmed = locationInput.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations([...locations, trimmed]);
      setLocationInput("");
    }
  };

  const handleAddAvoid = () => {
    const trimmed = avoidInput.trim();
    if (trimmed && !avoidCompanies.includes(trimmed)) {
      setAvoidCompanies([...avoidCompanies, trimmed]);
      setAvoidInput("");
    }
  };

  const toggleSeniority = (level: SeniorityLevel) => {
    if (seniority.includes(level)) {
      setSeniority(seniority.filter((s) => s !== level));
    } else {
      setSeniority([...seniority, level]);
    }
  };

  const toggleJobType = (type: string) => {
    if (jobTypes.includes(type)) {
      setJobTypes(jobTypes.filter((t) => t !== type));
    } else {
      setJobTypes([...jobTypes, type]);
    }
  };

  const handleSave = async () => {
    const payload: Preferences = {
      roles,
      locations,
      remote,
      seniority,
      job_types: jobTypes,
      companies_to_avoid: avoidCompanies,
      excluded_companies: avoidCompanies,
      min_match_score: minMatchScore,
    };

    const validation = PreferencesSchema.safeParse(payload);
    if (!validation.success) {
      toast.error("Please verify preferences format.");
      return;
    }

    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(validation.data);
        toast.success(
          isProfilePage
            ? "Preferences updated successfully."
            : "Onboarding complete! Welcome to Qlam."
        );
        if (onComplete) onComplete();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save preferences.");
      } finally {
        setIsSaving(false);
      }
    } else if (onComplete) {
      onComplete();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">
          {isProfilePage ? "Job Matching Preferences" : "Target Job Preferences"}
        </CardTitle>
        <CardDescription>
          Customize what jobs Qlam finds and applies to on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Roles */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Target Job Titles / Roles</Label>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="e.g. Full Stack Engineer, Frontend Developer"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRole())}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRole}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {roles.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                No target roles added yet. Add at least one title you want to target.
              </span>
            ) : (
              roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs flex items-center gap-1">
                  {r}
                  <button
                    type="button"
                    onClick={() => setRoles(roles.filter((item) => item !== r))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Locations & Remote */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs flex-1"
                placeholder="e.g. San Francisco, CA or London"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLocation())}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLocation}
                className="h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {locations.map((loc) => (
                <Badge key={loc} variant="outline" className="text-xs flex items-center gap-1">
                  {loc}
                  <button
                    type="button"
                    onClick={() => setLocations(locations.filter((item) => item !== loc))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-2 rounded-xl border border-border p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pref-remote" className="text-xs font-semibold cursor-pointer">
                  Open to Remote Roles
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Include remote-first and distributed jobs
                </p>
              </div>
              <Switch id="pref-remote" checked={remote} onCheckedChange={setRemote} />
            </div>
          </div>
        </div>

        {/* Seniority */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-xs font-semibold">Target Seniority Levels</Label>
          <div className="flex flex-wrap gap-2">
            {SENIORITY_OPTIONS.map((opt) => {
              const selected = seniority.includes(opt.id);
              return (
                <Button
                  key={opt.id}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSeniority(opt.id)}
                  className="h-7 text-xs"
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Job Types */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-xs font-semibold">Job Type</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map((opt) => {
              const selected = jobTypes.includes(opt.id);
              return (
                <Button
                  key={opt.id}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleJobType(opt.id)}
                  className="h-7 text-xs"
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Companies to avoid */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-xs font-semibold">Companies to Avoid</Label>
          <p className="text-[11px] text-muted-foreground">
            Current employers or specific companies you never want Qlam to apply to.
          </p>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="e.g. Current Employer Inc"
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAvoid())}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAvoid}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {avoidCompanies.map((c) => (
              <Badge key={c} variant="destructive" className="text-xs flex items-center gap-1">
                {c}
                <button
                  type="button"
                  onClick={() => setAvoidCompanies(avoidCompanies.filter((item) => item !== c))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Minimum Match Score */}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              <Label htmlFor="pref-min-score" className="text-xs font-semibold">
                Minimum Match Score for Auto Apply
              </Label>
            </div>
            <span className="text-sm font-bold text-primary">{minMatchScore}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Only jobs scoring at or above this threshold will be queued for automatic submission
            (Default: 70%).
          </p>
          <div className="flex items-center gap-4">
            <input
              id="pref-min-score"
              type="range"
              min="0"
              max="100"
              step="5"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
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

          <Button onClick={handleSave} disabled={isSaving} size="sm" className="min-w-[150px]">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : isProfilePage ? (
              <>
                <Save className="h-4 w-4 mr-2" /> Save Preferences
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Finish Onboarding <Check className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
