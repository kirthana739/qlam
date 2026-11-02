import { FileCheck } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function ApplicationsPage() {
  return (
    <EmptyState
      icon={FileCheck}
      title="Applications"
      description="Active and completed job applications will appear here."
    />
  );
}
