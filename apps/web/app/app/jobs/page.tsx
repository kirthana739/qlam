import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function JobsPage() {
  return (
    <EmptyState
      icon={Briefcase}
      title="Jobs"
      description="Discovered job listings matching your profile will appear here."
    />
  );
}
