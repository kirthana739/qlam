import { User } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";

export default function ProfilePage() {
  return (
    <EmptyState
      icon={User}
      title="Profile"
      description="Your uploaded resume, parsed skills, and tailoring preferences will appear here."
    />
  );
}
