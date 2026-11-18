import { JobsFeed } from "@/components/jobs/jobs-feed";
import { Briefcase } from "lucide-react";

export const metadata = {
  title: "Matched Jobs | Qlam",
  description: "Browse AI-matched job listings tailored to your resume and career preferences.",
};

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Matched Jobs Feed
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalized job recommendations ranked by AI similarity and qualification fit.
          </p>
        </div>
      </div>

      <JobsFeed />
    </div>
  );
}
