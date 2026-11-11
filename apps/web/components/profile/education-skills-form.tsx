"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GraduationCap, Award, FolderGit2, Wrench } from "lucide-react";
import {
  type ResumeEducationItem,
  type ResumeSkillItem,
  type ResumeProjectItem,
  type ResumeCertificationItem,
} from "@qlam/core";

interface EducationSkillsFormProps {
  education: ResumeEducationItem[];
  skills: ResumeSkillItem[];
  projects: ResumeProjectItem[];
  certifications: ResumeCertificationItem[];
  onChangeEducation: (items: ResumeEducationItem[]) => void;
  onChangeSkills: (items: ResumeSkillItem[]) => void;
  onChangeProjects: (items: ResumeProjectItem[]) => void;
  onChangeCertifications: (items: ResumeCertificationItem[]) => void;
}

export function EducationSkillsForm({
  education,
  skills,
  projects,
  certifications,
  onChangeEducation,
  onChangeSkills,
  onChangeProjects,
  onChangeCertifications,
}: EducationSkillsFormProps) {
  // Education handlers
  const handleAddEducation = () => {
    onChangeEducation([
      ...education,
      { institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", gpa: "", highlights: [] },
    ]);
  };
  const handleUpdateEducation = (idx: number, field: keyof ResumeEducationItem, val: unknown) => {
    const updated = [...education];
    const item = updated[idx];
    if (item) {
      updated[idx] = { ...item, [field]: val };
      onChangeEducation(updated);
    }
  };
  const handleRemoveEducation = (idx: number) => {
    onChangeEducation(education.filter((_, i) => i !== idx));
  };

  // Skills handlers
  const handleAddSkill = () => {
    onChangeSkills([...skills, { name: "", category: "General", level: "", keywords: [] }]);
  };
  const handleUpdateSkill = (idx: number, field: keyof ResumeSkillItem, val: unknown) => {
    const updated = [...skills];
    const item = updated[idx];
    if (item) {
      updated[idx] = { ...item, [field]: val };
      onChangeSkills(updated);
    }
  };
  const handleRemoveSkill = (idx: number) => {
    onChangeSkills(skills.filter((_, i) => i !== idx));
  };

  // Projects handlers
  const handleAddProject = () => {
    onChangeProjects([
      ...projects,
      { name: "", description: "", url: "", technologies: [], highlights: [] },
    ]);
  };
  const handleUpdateProject = (idx: number, field: keyof ResumeProjectItem, val: unknown) => {
    const updated = [...projects];
    const item = updated[idx];
    if (item) {
      updated[idx] = { ...item, [field]: val };
      onChangeProjects(updated);
    }
  };
  const handleRemoveProject = (idx: number) => {
    onChangeProjects(projects.filter((_, i) => i !== idx));
  };

  // Certifications handlers
  const handleAddCert = () => {
    onChangeCertifications([...certifications, { name: "", issuer: "", date: "", url: "" }]);
  };
  const handleUpdateCert = (idx: number, field: keyof ResumeCertificationItem, val: string) => {
    const updated = [...certifications];
    const item = updated[idx];
    if (item) {
      updated[idx] = { ...item, [field]: val };
      onChangeCertifications(updated);
    }
  };
  const handleRemoveCert = (idx: number) => {
    onChangeCertifications(certifications.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-8">
      {/* Education */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Education
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddEducation} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Education
          </Button>
        </div>

        {education.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No education listed.</p>
        ) : (
          <div className="space-y-3">
            {education.map((edu, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{edu.institution || "New School"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEducation(idx)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Institution"
                    value={edu.institution}
                    onChange={(e) => handleUpdateEducation(idx, "institution", e.target.value)}
                  />
                  <Input
                    className="h-7 text-xs"
                    placeholder="Degree (e.g. B.S.)"
                    value={edu.degree}
                    onChange={(e) => handleUpdateEducation(idx, "degree", e.target.value)}
                  />
                  <Input
                    className="h-7 text-xs"
                    placeholder="Field of Study"
                    value={edu.fieldOfStudy || ""}
                    onChange={(e) => handleUpdateEducation(idx, "fieldOfStudy", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Skills
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddSkill} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Skill
          </Button>
        </div>

        {skills.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No skills listed.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {skills.map((skill, idx) => (
              <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded-md border border-border bg-card">
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="Skill name"
                  value={skill.name}
                  onChange={(e) => handleUpdateSkill(idx, "name", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSkill(idx)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-primary" /> Key Projects
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddProject} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No projects listed.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((proj, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    className="h-7 text-xs max-w-[200px]"
                    placeholder="Project Name"
                    value={proj.name}
                    onChange={(e) => handleUpdateProject(idx, "name", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProject(idx)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  className="text-xs"
                  placeholder="Project description and impact..."
                  value={proj.description || ""}
                  onChange={(e) => handleUpdateProject(idx, "description", e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Certifications
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddCert} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Certification
          </Button>
        </div>

        {certifications.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No certifications listed.</p>
        ) : (
          <div className="space-y-2">
            {certifications.map((cert, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="Certification Name"
                  value={cert.name}
                  onChange={(e) => handleUpdateCert(idx, "name", e.target.value)}
                />
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="Issuer"
                  value={cert.issuer}
                  onChange={(e) => handleUpdateCert(idx, "issuer", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCert(idx)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
