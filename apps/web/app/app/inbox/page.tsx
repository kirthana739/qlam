import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function InboxPage() {
  return (
    <EmptyState
      icon={Inbox}
      title="Inbox"
      description="Recruiter responses and application updates will appear here."
    />
  );
}
