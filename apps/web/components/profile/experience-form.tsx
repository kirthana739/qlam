"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { type ResumeExperienceItem } from "@qlam/core";

interface ExperienceFormProps {
  experience: ResumeExperienceItem[];
  onChangeExperience: (updated: ResumeExperienceItem[]) => void;
}

export function ExperienceForm({
  experience,
  onChangeExperience,
}: ExperienceFormProps) {
  const handleAdd = () => {
    const newItem: ResumeExperienceItem = {
      company: "",
      position: "",
      location: "",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
      highlights: [],
    };
    onChangeExperience([...experience, newItem]);
  };

  const handleUpdate = (
    index: number,
    field: keyof ResumeExperienceItem,
    val: unknown
  ) => {
    const updated = [...experience];
    const item = updated[index];
    if (item) {
      updated[index] = { ...item, [field]: val };
      onChangeExperience(updated);
    }
  };

  const handleRemove = (index: number) => {
    onChangeExperience(experience.filter((_, i) => i !== index));
  };

  const handleAddHighlight = (expIndex: number) => {
    const updated = [...experience];
    const item = updated[expIndex];
    if (item) {
      const highlights = [...(item.highlights || []), ""];
      updated[expIndex] = { ...item, highlights };
      onChangeExperience(updated);
    }
  };

  const handleUpdateHighlight = (
    expIndex: number,
    hIndex: number,
    val: string
  ) => {
    const updated = [...experience];
    const item = updated[expIndex];
    if (item) {
      const highlights = [...(item.highlights || [])];
      highlights[hIndex] = val;
      updated[expIndex] = { ...item, highlights };
      onChangeExperience(updated);
    }
  };

  const handleRemoveHighlight = (expIndex: number, hIndex: number) => {
    const updated = [...experience];
    const item = updated[expIndex];
    if (item) {
      const highlights = (item.highlights || []).filter((_, i) => i !== hIndex);
      updated[expIndex] = { ...item, highlights };
      onChangeExperience(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Work Experience
          </h3>
          <p className="text-xs text-muted-foreground">
            List your relevant roles in reverse chronological order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="text-xs h-8"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Role
        </Button>
      </div>

      {experience.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No experience entries added. Click &quot;Add Role&quot; above to add one.
        </div>
      ) : (
        <div className="space-y-6">
          {experience.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-border bg-card space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold text-primary">
                  Role #{idx + 1}: {item.position || "Untitled"} {item.company ? `at ${item.company}` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(idx)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Company *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={item.company}
                    onChange={(e) => handleUpdate(idx, "company", e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Position / Title *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={item.position}
                    onChange={(e) => handleUpdate(idx, "position", e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input
                    className="h-8 text-xs"
                    value={item.location || ""}
                    onChange={(e) => handleUpdate(idx, "location", e.target.value)}
                    placeholder="New York, NY (or Remote)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date *</Label>
                    <Input
                      className="h-8 text-xs"
                      value={item.startDate}
                      onChange={(e) => handleUpdate(idx, "startDate", e.target.value)}
                      placeholder="e.g. 2021-03"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      className="h-8 text-xs"
                      disabled={item.current}
                      value={item.current ? "Present" : item.endDate || ""}
                      onChange={(e) => handleUpdate(idx, "endDate", e.target.value)}
                      placeholder="e.g. 2023-08"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id={`current-role-${idx}`}
                  checked={item.current}
                  onCheckedChange={(checked) => handleUpdate(idx, "current", checked)}
                />
                <Label htmlFor={`current-role-${idx}`} className="text-xs cursor-pointer">
                  I currently work here
                </Label>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={item.description || ""}
                  onChange={(e) => handleUpdate(idx, "description", e.target.value)}
                  placeholder="Overview of your responsibilities..."
                />
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Bullet Points & Key Achievements</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddHighlight(idx)}
                    className="h-6 text-[11px] text-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Bullet
                  </Button>
                </div>
                {(item.highlights || []).map((h, hIdx) => (
                  <div key={hIdx} className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs flex-1"
                      value={h}
                      onChange={(e) => handleUpdateHighlight(idx, hIdx, e.target.value)}
                      placeholder="e.g. Architected microservices improving throughput by 40%..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveHighlight(idx, hIdx)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
