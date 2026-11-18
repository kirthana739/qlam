import { Badge } from "@/components/ui/badge";
import type { ResumeData } from "@qlam/core";
import { Sparkles } from "lucide-react";

interface ResumeDiffCardProps {
  title: string;
  subtitle: string;
  resume: ResumeData;
  isTailored?: boolean;
  counterpartResume: ResumeData;
}

export function ResumeDiffCard({
  title,
  subtitle,
  resume,
  isTailored = false,
  counterpartResume,
}: ResumeDiffCardProps) {
  // Collect all base highlights into a normalized set for comparison
  const counterpartHighlights = new Set<string>();
  for (const exp of counterpartResume.experience || []) {
    for (const h of exp.highlights || []) {
      counterpartHighlights.add(h.trim().toLowerCase());
    }
  }

  const isSummaryModified =
    Boolean(resume.summary) &&
    Boolean(counterpartResume.summary) &&
    resume.summary.trim().toLowerCase() !== counterpartResume.summary.trim().toLowerCase();

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-6 shadow-sm">
      <div className="border-b border-border/60 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
            {isTailored && <Sparkles className="h-4 w-4 text-primary" />}
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {isTailored ? (
          <Badge variant="secondary" className="text-[11px]">
            Tailored Version
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px]">
            Base Version
          </Badge>
        )}
      </div>

      {/* Header Basics */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-foreground">{resume.basics?.name || "Applicant Name"}</h3>
        {resume.basics?.headline && (
          <p className="text-xs text-muted-foreground">{resume.basics.headline}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {[resume.basics?.email, resume.basics?.phone, resume.basics?.location?.city]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>

      {/* Professional Summary */}
      {resume.summary && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Professional Summary
            </h4>
            {isTailored && isSummaryModified && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                Adapted for Job
              </Badge>
            )}
          </div>
          <p
            className={`text-xs leading-relaxed p-2.5 rounded-lg ${
              isTailored && isSummaryModified
                ? "bg-primary/5 border border-primary/20 text-foreground font-medium"
                : "text-muted-foreground bg-muted/20"
            }`}
          >
            {resume.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Experience
          </h4>
          <div className="space-y-4">
            {resume.experience.map((exp, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
                  <span className="text-xs font-bold text-foreground">{exp.position}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {[exp.startDate, exp.current ? "Present" : exp.endDate].filter(Boolean).join(" – ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {exp.company} {exp.location ? `• ${exp.location}` : ""}
                </div>

                <ul className="space-y-1.5 pt-1">
                  {(exp.highlights || []).map((bullet, bIdx) => {
                    const isIdentical = counterpartHighlights.has(bullet.trim().toLowerCase());
                    const isHighlightAdapted = isTailored && !isIdentical;

                    return (
                      <li
                        key={bIdx}
                        className={`text-xs leading-relaxed rounded-md p-1.5 transition-colors ${
                          isHighlightAdapted
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="text-primary mt-1 text-[10px]">•</span>
                          <span className="flex-1">{bullet}</span>
                          {isHighlightAdapted && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0"
                            >
                              Adapted
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Skills
          </h4>
          <div className="space-y-2">
            {resume.skills.map((skill, idx) => (
              <div key={idx} className="space-y-1">
                <span className="text-[11px] font-semibold text-foreground">{skill.name}</span>
                <div className="flex flex-wrap gap-1">
                  {(skill.keywords || []).map((kw, kIdx) => (
                    <Badge key={kIdx} variant="secondary" className="text-[11px]">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Education
          </h4>
          <div className="space-y-2">
            {resume.education.map((edu, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-semibold text-foreground">{edu.degree}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {[edu.startDate, edu.endDate].filter(Boolean).join(" – ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {edu.institution} {edu.gpa ? `• GPA: ${edu.gpa}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
