import { FileCheck } from "lucide-react";
import { ApplicationsListClient } from "@/components/applications/applications-list-client";

export const metadata = {
  title: "Applications | Qlam",
  description: "Track and review automated and assisted job applications.",
};

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" /> Applications
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor real-time status, manage custom employer questions, and inspect submission proofs.
          </p>
        </div>
      </div>

      <ApplicationsListClient />
    </div>
  );
}
