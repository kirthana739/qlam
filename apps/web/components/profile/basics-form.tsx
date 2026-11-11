"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { type ResumeBasics } from "@qlam/core";

interface BasicsFormProps {
  basics: ResumeBasics;
  summary: string;
  onChangeBasics: (updated: ResumeBasics) => void;
  onChangeSummary: (summary: string) => void;
}

export function BasicsForm({
  basics,
  summary,
  onChangeBasics,
  onChangeSummary,
}: BasicsFormProps) {
  const handleBasicsField = (field: keyof ResumeBasics, value: unknown) => {
    onChangeBasics({
      ...basics,
      [field]: value,
    });
  };

  const handleLocationField = (field: string, value: string) => {
    onChangeBasics({
      ...basics,
      location: {
        ...basics.location,
        [field]: value,
      },
    });
  };

  const handleAddLink = () => {
    const updatedLinks = [...(basics.links || []), { name: "LinkedIn", url: "" }];
    onChangeBasics({ ...basics, links: updatedLinks });
  };

  const handleUpdateLink = (index: number, key: "name" | "url", val: string) => {
    const updatedLinks = [...(basics.links || [])];
    const item = updatedLinks[index];
    if (item) {
      updatedLinks[index] = { ...item, [key]: val };
      onChangeBasics({ ...basics, links: updatedLinks });
    }
  };

  const handleRemoveLink = (index: number) => {
    const updatedLinks = (basics.links || []).filter((_, i) => i !== index);
    onChangeBasics({ ...basics, links: updatedLinks });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="basics-name">Full Name *</Label>
          <Input
            id="basics-name"
            value={basics.name || ""}
            onChange={(e) => handleBasicsField("name", e.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="basics-email">Email Address *</Label>
          <Input
            id="basics-email"
            type="email"
            value={basics.email || ""}
            onChange={(e) => handleBasicsField("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="basics-phone">Phone Number</Label>
          <Input
            id="basics-phone"
            value={basics.phone || ""}
            onChange={(e) => handleBasicsField("phone", e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="basics-headline">Professional Headline</Label>
          <Input
            id="basics-headline"
            value={basics.headline || ""}
            onChange={(e) => handleBasicsField("headline", e.target.value)}
            placeholder="Senior Full Stack Engineer"
          />
        </div>
      </div>

      {/* Location */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="basics-city">City</Label>
          <Input
            id="basics-city"
            value={basics.location?.city || ""}
            onChange={(e) => handleLocationField("city", e.target.value)}
            placeholder="San Francisco"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="basics-state">State / Province</Label>
          <Input
            id="basics-state"
            value={basics.location?.state || ""}
            onChange={(e) => handleLocationField("state", e.target.value)}
            placeholder="CA"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="basics-country">Country</Label>
          <Input
            id="basics-country"
            value={basics.location?.country || ""}
            onChange={(e) => handleLocationField("country", e.target.value)}
            placeholder="United States"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <Label htmlFor="basics-summary">Professional Summary</Label>
        <Textarea
          id="basics-summary"
          rows={3}
          value={summary || ""}
          onChange={(e) => onChangeSummary(e.target.value)}
          placeholder="Brief professional summary highlight your background and skills..."
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Links & Profiles (LinkedIn, GitHub, Portfolio)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLink}
            className="h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Link
          </Button>
        </div>

        {(basics.links || []).length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No links added yet.</p>
        ) : (
          <div className="space-y-2">
            {basics.links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="w-1/3 text-xs"
                  placeholder="e.g. LinkedIn"
                  value={link.name}
                  onChange={(e) => handleUpdateLink(idx, "name", e.target.value)}
                />
                <Input
                  className="flex-1 text-xs"
                  placeholder="https://..."
                  value={link.url}
                  onChange={(e) => handleUpdateLink(idx, "url", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLink(idx)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
