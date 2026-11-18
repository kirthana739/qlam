"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Preferences, PreferencesSchema, type TailoringStrength } from "@qlam/core";
import { Loader2, Save, Settings, Wand2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // tailoring settings (subset of preferences)
  const [strength, setStrength] = useState<TailoringStrength>("medium");
  const [autoApprove, setAutoApprove] = useState(false);

  // load existing preferences
  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("user_id", user.id)
        .single();

      if (profile?.preferences && typeof profile.preferences === "object") {
        const prefs = profile.preferences as Partial<Preferences>;
        if (prefs.tailoring_strength) setStrength(prefs.tailoring_strength);
        if (typeof prefs.auto_approve_tailored === "boolean") {
          setAutoApprove(prefs.auto_approve_tailored);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Fetch current full preferences so we only patch the two fields
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("user_id", userId)
        .single();

      const existing = (
        profile?.preferences && typeof profile.preferences === "object"
          ? profile.preferences
          : {}
      ) as Partial<Preferences>;

      const merged = PreferencesSchema.parse({
        ...existing,
        tailoring_strength: strength,
        auto_approve_tailored: autoApprove,
      });

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: merged })
        .eq("user_id", userId);

      if (error) throw new Error(error.message);
      toast.success("Tailoring settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Account-level preferences for resume tailoring and application automation.
        </p>
      </div>

      {/* Resume Tailoring */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> Resume Tailoring
          </CardTitle>
          <CardDescription className="text-xs">
            Control how aggressively Qlam adapts your resume for each job, and whether tailored
            resumes need your review before an application is submitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tailoring Strength */}
          <div className="space-y-2">
            <Label htmlFor="tailoring-strength" className="text-xs font-semibold">
              Tailoring Strength
            </Label>
            <Select
              value={strength}
              onValueChange={(v) => setStrength(v as TailoringStrength)}
            >
              <SelectTrigger id="tailoring-strength" className="h-9 text-xs w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light" className="text-xs">
                  <span className="font-medium">Light</span>
                  <span className="text-muted-foreground ml-2">
                    — reorder bullets only, keep phrasing intact
                  </span>
                </SelectItem>
                <SelectItem value="medium" className="text-xs">
                  <span className="font-medium">Medium</span>
                  <span className="text-muted-foreground ml-2">
                    — reorder &amp; gently rephrase using job wording
                  </span>
                </SelectItem>
                <SelectItem value="strong" className="text-xs">
                  <span className="font-medium">Strong</span>
                  <span className="text-muted-foreground ml-2">
                    — actively prioritise relevant bullets, omit weaker ones
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Facts (employers, titles, dates, degrees, numbers) are never changed regardless of
              strength.
            </p>
          </div>

          {/* Auto-approve */}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
            <div className="space-y-1">
              <Label htmlFor="auto-approve" className="text-xs font-semibold cursor-pointer">
                Auto-approve tailored resumes
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When enabled, the tailored resume is submitted without asking you to review it
                first. Turn off to review every tailored version at{" "}
                <span className="font-mono">/app/review/…</span> before it is sent.
              </p>
            </div>
            <Switch
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={setAutoApprove}
              className="shrink-0 mt-0.5"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="min-w-[130px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
